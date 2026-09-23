-- ==============================================================================
-- KUCSE25 Academic Resource Archive
-- Phase 3 Migration: Storage Quota Protection, Atomic Reservations & Duplicate Control
-- Migration: 20260923020000_phase3_storage_quota_optimization.sql
-- ==============================================================================

-- 1. STORAGE QUOTA CEILING TABLE
CREATE TABLE IF NOT EXISTS public.storage_quota (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_bytes BIGINT NOT NULL DEFAULT 838860800, -- 800 MB application safety ceiling
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.storage_quota (id, max_bytes)
VALUES (1, 838860800)
ON CONFLICT (id) DO UPDATE SET max_bytes = EXCLUDED.max_bytes;

ALTER TABLE public.storage_quota ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view storage quota ceiling" ON public.storage_quota;
CREATE POLICY "Public can view storage quota ceiling"
  ON public.storage_quota
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Only admins can modify storage quota ceiling" ON public.storage_quota;
CREATE POLICY "Only admins can modify storage quota ceiling"
  ON public.storage_quota
  FOR ALL
  TO authenticated
  USING (public.is_admin());

-- 2. STORAGE RESERVATIONS TABLE (CONCURRENCY CONTROL)
CREATE TABLE IF NOT EXISTS public.storage_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reserved_bytes BIGINT NOT NULL CHECK (reserved_bytes > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX IF NOT EXISTS idx_storage_reservations_expires ON public.storage_reservations(expires_at);
CREATE INDEX IF NOT EXISTS idx_storage_reservations_user ON public.storage_reservations(user_id);

ALTER TABLE public.storage_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own reservations" ON public.storage_reservations;
CREATE POLICY "Users can view own reservations"
  ON public.storage_reservations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

-- 3. UNIQUE HASH CONSTRAINT (ACTIVE FILES)
CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_active_file_hash
  ON public.resources (file_hash)
  WHERE status IN ('pending', 'approved');

-- 4. ATOMIC QUOTA RESERVATION RPC
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

  -- 3. Compute currently committed bytes (resources physically occupying storage)
  SELECT COALESCE(SUM(optimized_size_bytes), 0) INTO v_committed_bytes
  FROM public.resources
  WHERE storage_path IS NOT NULL
    AND status IN ('pending', 'approved', 'archived');

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

-- 5. RELEASE RESERVATION RPC
CREATE OR REPLACE FUNCTION public.release_storage_reservation(reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF reservation_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.storage_reservations
  WHERE id = reservation_id
    AND (user_id = auth.uid() OR public.is_admin() OR current_setting('request.jwt.claim.role', true) = 'service_role');

  RETURN true;
END;
$$;

-- 6. FINALIZE RESERVATION RPC
CREATE OR REPLACE FUNCTION public.finalize_storage_reservation(reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF reservation_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM public.storage_reservations
  WHERE id = reservation_id
    AND (user_id = auth.uid() OR public.is_admin() OR current_setting('request.jwt.claim.role', true) = 'service_role');

  RETURN true;
END;
$$;

-- 7. DUPLICATE HASH CHECK RPC
CREATE OR REPLACE FUNCTION public.check_duplicate_hash(p_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_hash IS NULL OR length(trim(p_hash)) = 0 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.resources
    WHERE file_hash = trim(p_hash)
      AND status IN ('pending', 'approved')
  );
END;
$$;

-- 8. STORAGE RLS ENHANCEMENT (STUDENT CAN CLEAN UP UNCONFIRMED STORAGE OBJECTS)
DROP POLICY IF EXISTS "Students can delete own unattached storage objects" ON storage.objects;
CREATE POLICY "Students can delete own unattached storage objects"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (
      public.is_admin()
      OR owner = auth.uid()
    )
  );

-- 9. PERMISSIONS & GRANTS
GRANT SELECT ON public.storage_quota TO authenticated, anon;
GRANT SELECT ON public.storage_reservations TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_storage(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_storage_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_storage_reservation(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_duplicate_hash(TEXT) TO authenticated, anon;
