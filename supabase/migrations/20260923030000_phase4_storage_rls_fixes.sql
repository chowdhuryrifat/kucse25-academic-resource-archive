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
DROP POLICY IF EXISTS "Public can read approved resource objects" ON storage.objects;
CREATE POLICY "Public can read approved resource objects"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (
    bucket_id = 'resources'
    AND EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.storage_path = storage.objects.name
        AND r.status = 'approved'
    )
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