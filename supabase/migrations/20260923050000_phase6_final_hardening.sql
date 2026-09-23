-- ==============================================================================
-- KUCSE25 Academic Resource Archive
-- Phase 6 Migration: Final Hardening Pass
-- Migration: 20260923050000_phase6_final_hardening.sql
--
-- 1. Per-format file-size limits are enforced at the DATABASE boundary, not just
--    in the frontend/optimizer. A malicious authenticated client that bypasses
--    the UI cannot insert records that exceed the intended limits.
--    Limits (input / stored):
--      PDF           20 MB / 10 MB
--      PPT / PPTX    15 MB / 15 MB
--      DOC / DOCX    15 MB / 15 MB
--      PNG / JPEG    10 MB / 10 MB
--      general input ceiling   25 MB
-- 2. reserve_storage now counts EVERY resources row with a non-null
--    storage_path (regardless of status). A rejected resource whose physical
--    file could not be purged therefore continues to occupy quota until it is
--    actually deleted, so leftover orphans can never push real Storage usage
--    past the 800 MB ceiling unnoticed.
-- 3. The storage bucket is tightened: 15 MB per-object ceiling (the largest
--    stored/optimized size any format may legitimately reach) and
--    allowed_mime_types narrowed to the seven supported formats. The overly
--    broad application/octet-stream and zip MIME types are removed.
-- 4. A dedicated RPC exposes the cleanup-pending queue (rejected resources
--    that still hold a storage_path) so failures to delete a rejected physical
--    file remain detectable and retryable by moderators.
-- ==============================================================================

-- 1. PER-FORMAT SIZE LIMITS (DATABASE BOUNDARY)
-- Enforced for every INSERT/UPDATE. Added NOT VALID so existing rows are never
-- rejected by the migration, then validated when the current data is clean.

-- 1a. storage_path alignment to the canonical schema (TEXT, nullable).
-- The live table had been hardened to NOT NULL with no default, which made the
-- rejection lifecycle impossible: clearing the pointer (storage_path = NULL)
-- after a physical file deletion violated the constraint, so rejected files
-- could be neither detached nor orphaned-correct. NULL is the canonical
-- "no physical file" state; "cleanup-pending" is status='rejected' AND
-- storage_path IS NOT NULL. The DROP is a no-op on schemas already nullable.
ALTER TABLE public.resources
  ALTER COLUMN storage_path DROP NOT NULL;

ALTER TABLE public.resources
  DROP CONSTRAINT IF EXISTS resources_size_limits_check;

ALTER TABLE public.resources
  ADD CONSTRAINT resources_size_limits_check CHECK (
    COALESCE(original_size_bytes, 0) <= 26214400
    AND COALESCE(optimized_size_bytes, 0) <= 26214400
    AND (
      lower(mime_type) <> 'application/pdf'
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 20971520 AND COALESCE(optimized_size_bytes, 0) <= 10485760)
    )
    AND (
      lower(mime_type) NOT IN (
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 15728640 AND COALESCE(optimized_size_bytes, 0) <= 15728640)
    )
    AND (
      lower(mime_type) NOT IN (
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 15728640 AND COALESCE(optimized_size_bytes, 0) <= 15728640)
    )
    AND (
      lower(mime_type) NOT IN ('image/png', 'image/jpeg')
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 10485760 AND COALESCE(optimized_size_bytes, 0) <= 10485760)
    )
  ) NOT VALID;

-- Validate the constraint when no existing row violates it (guarded so a legacy
-- row can never break the migration itself).
DO $$
DECLARE
  v_violations BIGINT;
BEGIN
  SELECT count(*) INTO v_violations
  FROM public.resources
  WHERE NOT (
    COALESCE(original_size_bytes, 0) <= 26214400
    AND COALESCE(optimized_size_bytes, 0) <= 26214400
    AND (
      lower(mime_type) <> 'application/pdf'
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 20971520 AND COALESCE(optimized_size_bytes, 0) <= 10485760)
    )
    AND (
      lower(mime_type) NOT IN (
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      )
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 15728640 AND COALESCE(optimized_size_bytes, 0) <= 15728640)
    )
    AND (
      lower(mime_type) NOT IN (
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 15728640 AND COALESCE(optimized_size_bytes, 0) <= 15728640)
    )
    AND (
      lower(mime_type) NOT IN ('image/png', 'image/jpeg')
      OR original_size_bytes IS NULL
      OR (COALESCE(original_size_bytes, 0) <= 10485760 AND COALESCE(optimized_size_bytes, 0) <= 10485760)
    )
  );

  IF v_violations = 0 THEN
    ALTER TABLE public.resources VALIDATE CONSTRAINT resources_size_limits_check;
  ELSE
    RAISE NOTICE 'resources_size_limits_check left NOT VALID; % legacy row(s) violate it.', v_violations;
  END IF;
END;
$$;

-- 2. QUOTA: COUNT ALL PHYSICALLY RETAINED FILES (INCLUDING REJECTED LEFTOVERS)
-- The previous formula only counted pending/approved/archived rows. A rejected
-- resource whose storage deletion failed would keep an object in the bucket but
-- vanish from the quota math — exactly the orphan scenario this closed. Now any
-- row with a non-null storage_path counts as committed until it is cleared.
CREATE OR REPLACE FUNCTION public.reserve_storage(required_bytes BIGINT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_id UUID;
  v_res_id UUID;
  v_committed_bytes BIGINT;
  v_active_reservations BIGINT;
  v_max_bytes BIGINT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required for storage reservation.';
  END IF;

  IF required_bytes IS NULL OR required_bytes <= 0 THEN
    RAISE EXCEPTION 'Invalid reservation bytes specified: %', required_bytes;
  END IF;

  -- 1. Lock quota row to serialize concurrent checks
  SELECT max_bytes INTO v_max_bytes
  FROM public.storage_quota
  WHERE id = 1
  FOR UPDATE;

  IF v_max_bytes IS NULL THEN
    v_max_bytes := 838860800; -- 800 MB fallback
  END IF;

  -- 2. Prune expired reservations
  DELETE FROM public.storage_reservations
  WHERE expires_at <= now();

  -- 3. Compute currently committed bytes (every retained object regardless of
  --    status, so rejected-but-not-yet-deleted files keep their footprint)
  SELECT COALESCE(SUM(optimized_size_bytes), 0) INTO v_committed_bytes
  FROM public.resources
  WHERE storage_path IS NOT NULL;

  -- 4. Compute currently active in-flight reservations
  SELECT COALESCE(SUM(reserved_bytes), 0) INTO v_active_reservations
  FROM public.storage_reservations
  WHERE expires_at > now();

  -- 5. Strict ceiling check (800 MB)
  IF (v_committed_bytes + v_active_reservations + required_bytes) > v_max_bytes THEN
    RAISE EXCEPTION 'STORAGE_QUOTA_EXCEEDED: Archive storage is temporarily full. Please try again later.';
  END IF;

  -- 6. Insert new reservation with 10-minute validity
  INSERT INTO public.storage_reservations (user_id, reserved_bytes, expires_at)
  VALUES (v_caller_id, required_bytes, now() + interval '10 minutes')
  RETURNING id INTO v_res_id;

  RETURN v_res_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_storage(BIGINT) TO authenticated;

-- 3. STORAGE BUCKET: CLOSE MIME TYPES + PER-OBJECT CEILING
-- file_size_limit is now the largest legitimate stored (optimized) size any
-- format may reach: office documents, 15 MB. Excessively broad
-- application/octet-stream (and zip, which the pipeline never produces) are no
-- longer accepted for new uploads.
UPDATE storage.buckets
SET file_size_limit = 15728640, -- 15 MB (largest legitimate optimized file)
    allowed_mime_types = ARRAY[
      'application/pdf',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/png',
      'image/jpeg'
    ]
WHERE id = 'resources';

-- 4. REJECTED-FILE CLEANUP QUEUE (CLEANUP-PENDING DETECTION)
-- A rejected resource that still holds storage_path is cleanup-pending: a
-- physical deletion previously failed and the path MUST NOT be forgotten.
-- This RPC is the moderator surface for that queue and enforces moderation
-- access even though it is SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.get_rejected_storage_cleanup_queue()
RETURNS TABLE(
  id UUID,
  original_filename TEXT,
  storage_path TEXT,
  optimized_size_bytes BIGINT,
  rejected_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_admin()
     AND (current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role') THEN
    RAISE EXCEPTION 'Unauthorized: Only CR/ACR moderators can access the rejected-file cleanup queue.';
  END IF;

  RETURN QUERY
  SELECT
    r.id,
    r.original_filename,
    r.storage_path,
    r.optimized_size_bytes,
    r.reviewed_at
  FROM public.resources r
  WHERE r.status = 'rejected'
    AND r.storage_path IS NOT NULL
  ORDER BY r.updated_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_rejected_storage_cleanup_queue() TO authenticated;