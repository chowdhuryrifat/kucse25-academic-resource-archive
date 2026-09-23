-- ==============================================================================
-- KUCSE25 Academic Resource Archive
-- Phase 5 Migration: Hardened Public Boundary
-- Migration: 20260923040000_phase5_public_boundary.sql
--
-- Closes the remaining public-exposure gaps identified in the pipeline audit:
--
--  1. `public_resources` view is narrowed to ONLY the fields the public UI
--     needs (id, course_id, original_filename, resource_type, uploader_name,
--     download_count, original_size_bytes, created_at). The stale `filename`
--     alias, `mime_type`, and `status` columns are removed.
--
--  2. The broad anon/authenticated SELECT policy on `resources` is DROPPED.
--     Previously any anonymous visitor holding an approved row id could read
--     internal columns such as `storage_path`, `uploader_id`, `file_hash`, and
--     moderation fields. Public reads now flow ONLY through the privacy view.
--
--  3. The anon/authenticated SELECT policy on `profiles` for uploaders of
--     approved resources is DROPPED. It would have let any visitor SELECT all
--     columns of those profile rows, including email and student_id.
--
--  4. A SECURITY DEFINER `get_resource_read_info` RPC is added as the ONLY
--     way the app resolves a resource's storage path for on-demand signed
--     URLs (Document Reader / Download). It returns row metadata exclusively
--     for APPROVED resources, so internal paths are never exposed publicly.
--     (Signed URLs still require the existing approved-only
--     `Public can read approved resource objects` SELECT policy on
--     storage.objects.)
-- ==============================================================================

-- 1. NARROW THE PUBLIC PRIVACY VIEW
DROP VIEW IF EXISTS public.public_resources;
CREATE VIEW public.public_resources AS
SELECT
  r.id,
  r.course_id,
  r.original_filename,
  r.resource_type,
  p.name AS uploader_name,
  r.download_count,
  r.original_size_bytes,
  r.created_at
FROM public.resources r
JOIN public.profiles p ON r.uploader_id = p.id
WHERE r.status = 'approved';

-- 2. REMOVE BROAD PUBLIC SELECT ON resources (closed via public_resources view)
DROP POLICY IF EXISTS "Public can view approved resources" ON public.resources;

-- 3. REMOVE PUBLIC SELECT ON profiles FOR UPLOADER NAMES
-- (uploader_name continues to be served by the privacy view only)
DROP POLICY IF EXISTS "Public can view approved resource uploader names" ON public.profiles;

-- 3b. CLOSE LEGACY PUBLIC READ POLICIES (PRE-EXISTING DEPLOYS ONLY)
-- Earlier deployments exposed uploader profile rows and the class roster to the
-- public under names that differ from the policies dropped above. RLS policies
-- are OR-composed, so a single legacy policy would reopen exactly what this
-- migration closes (emails, student IDs, roster). They are dropped only when
-- present; the roster table itself may not exist in other environments.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'Public can read active profiles for uploader names'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public can read active profiles for uploader names" ON public.profiles';
  END IF;

  IF to_regclass('public.students_roster') IS NOT NULL AND EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'students_roster'
      AND policyname = 'Public can view roster directory for name verification'
  ) THEN
    EXECUTE 'DROP POLICY IF EXISTS "Public can view roster directory for name verification" ON public.students_roster';
  END IF;
END;
$$;

-- 4. STORAGE-PATH RESOLUTION RPC (APPROVED RESOURCES ONLY)
CREATE OR REPLACE FUNCTION public.get_resource_read_info(res_id UUID)
RETURNS TABLE(storage_path TEXT, original_filename TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT r.storage_path, r.original_filename
  FROM public.resources r
  WHERE r.id = res_id
    AND r.status = 'approved';
END;
$$;

-- 5. PERMISSIONS & GRANTS
GRANT SELECT ON public.public_resources TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_resource_read_info(UUID) TO anon, authenticated;