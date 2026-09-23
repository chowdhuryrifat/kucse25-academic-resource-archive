-- ==============================================================================
-- KUCSE25 Academic Resource Archive
-- Phase 4 Migration: Storage RLS Audit Fixes
-- Migration: 20260923030000_phase4_storage_rls_fixes.sql
--
-- Resolves findings from the Phase 3 pipeline audit:
--  1. Public on-demand signed URLs were impossible because anon/authenticated
--     non-admin roles had no SELECT policy on storage.objects (the Document
--     Reader calls createSignedUrl, which requires the row to be readable).
--  2. The storage INSERT policy accepted any object path; it is now restricted
--     to the canonical <uuid>/<sanitized-filename> layout produced by
--     ResourceService.createResourceSubmission.
-- ==============================================================================

-- 1. PUBLIC ON-DEMAND SIGNED-URL ACCESS (APPROVED RESOURCES ONLY)
-- The storage.objects SELECT policy MUST NOT query public.resources directly:
-- after Phase 5 removes anon/authenticated RLS visibility on resources, a
-- subquery from a policy would evaluate under the caller's role and be
-- permanently false. Resolution is therefore delegated to a SECURITY DEFINER
-- helper that bypasses RLS and answers strictly about APPROVED resources.
CREATE OR REPLACE FUNCTION public.resource_storage_path_is_approved(p_path TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_path IS NULL OR length(trim(p_path)) = 0 THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1 FROM public.resources
    WHERE storage_path = trim(p_path)
      AND status = 'approved'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.resource_storage_path_is_approved(TEXT) TO anon, authenticated;

DROP POLICY IF EXISTS "Public can read approved resource objects" ON storage.objects;
CREATE POLICY "Public can read approved resource objects"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'resources'
    AND public.resource_storage_path_is_approved(name)
  );

-- 2. HARDENED UPLOAD PATH LAYOUT
DROP POLICY IF EXISTS "Authenticated students can upload resource files" ON storage.objects;
CREATE POLICY "Authenticated students can upload resource files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resources'
    AND public.is_active_student()
    AND storage.objects.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
  );

-- 3. CLOSE LEGACY UNRESTRICTED UPLOAD POLICY (PRE-EXISTING DEPLOYS ONLY)
-- Deployments that predate this migration may carry an unrestricted
-- "Authenticated students can upload files" INSERT policy on storage.objects
-- with no canonical-path enforcement. RLS policies are OR-composed, so a single
-- legacy permissive policy would defeat the hardened policy above. Any policy
-- under that legacy name is dropped unconditionally when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Authenticated students can upload files'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Authenticated students can upload files" ON storage.objects';
  END IF;
END;
$$;

-- 4. REBASED STUDENT/ADMIN READ POLICY (RLS-SAFE)
-- Phase 2's "Students and users can read resource objects" policy queried
-- public.resources directly, which is invisible under RLS to non-admin
-- authenticated roles. Recreate it with the SECURITY DEFINER helper so that
-- any student can read approved objects (and their own uploads) for signed
-- URLs, without exposing the resources table itself.
DROP POLICY IF EXISTS "Students and users can read resource objects" ON storage.objects;
CREATE POLICY "Students and users can read resource objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (
      public.is_admin()
      OR public.resource_storage_path_is_approved(name)
      OR EXISTS (
        SELECT 1 FROM public.resources r
        WHERE r.storage_path = storage.objects.name
          AND r.uploader_id = auth.uid()
      )
    )
  );