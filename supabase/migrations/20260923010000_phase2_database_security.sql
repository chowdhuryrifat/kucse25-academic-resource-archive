-- ==============================================================================
-- KUCSE25 PHASE 2: DATABASE SCHEMA, SECURITY CONSTRAINTS & RLS MIGRATION
-- Batch 25, Department of Computer Science & Engineering, Khulna University
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. REUSABLE UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- 3. AUTHORITATIVE KUCSE25 STUDENT ROSTER
-- Holds the master batch list of all 39 active students
-- Format: 250201 to 250243, excluding 10, 16, 17, 27
CREATE TABLE IF NOT EXISTS public.kucse25_roster (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'cr', 'acr')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT roster_student_id_check CHECK (
    student_id ~ '^2502(0[1-9]|[1-3][0-9]|4[0-3])$'
    AND student_id NOT IN ('250210', '250216', '250217', '250227')
  ),
  CONSTRAINT roster_email_check CHECK (
    lower(email) ~ '^2502(0[1-9]|[1-3][0-9]|4[0-3])@ku\.ac\.bd$'
    AND lower(email) NOT IN ('250210@ku.ac.bd', '250216@ku.ac.bd', '250217@ku.ac.bd', '250227@ku.ac.bd')
  )
);

DROP TRIGGER IF EXISTS set_roster_updated_at ON public.kucse25_roster;
CREATE TRIGGER set_roster_updated_at
  BEFORE UPDATE ON public.kucse25_roster
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Seed all 39 active batch members from src/data/whitelist.ts
INSERT INTO public.kucse25_roster (student_id, name, email, role, is_active)
VALUES
  ('250201', 'LAMEYA TABASUM', '250201@ku.ac.bd', 'student', true),
  ('250202', 'SK. SAFINUR RAHMAN', '250202@ku.ac.bd', 'student', true),
  ('250203', 'DIPU PAUL', '250203@ku.ac.bd', 'student', true),
  ('250204', 'NAIMA ALAM', '250204@ku.ac.bd', 'student', true),
  ('250205', 'NAYMUR RAHMAN', '250205@ku.ac.bd', 'student', true),
  ('250206', 'SUDIP OJHA', '250206@ku.ac.bd', 'student', true),
  ('250207', 'ASHRAFUL MUKADDIS SHEETOL', '250207@ku.ac.bd', 'student', true),
  ('250208', 'FAHIM JUBAIR', '250208@ku.ac.bd', 'student', true),
  ('250209', 'SHAHARIN ZAMAN ROZA', '250209@ku.ac.bd', 'student', true),
  ('250211', 'MD. SUHAIL AREFIN RIDOY', '250211@ku.ac.bd', 'student', true),
  ('250212', 'ESMATUL HAQUE ERA', '250212@ku.ac.bd', 'student', true),
  ('250213', 'ANIK MONDAL', '250213@ku.ac.bd', 'student', true),
  ('250214', 'ARITRYA SARKAR TIRTHA', '250214@ku.ac.bd', 'student', true),
  ('250215', 'MD. ADIL ISHTIAQUE', '250215@ku.ac.bd', 'student', true),
  ('250218', 'SAJU PAUL', '250218@ku.ac.bd', 'student', true),
  ('250219', 'ADIL AHNAF SAIKAT', '250219@ku.ac.bd', 'student', true),
  ('250220', 'PRITOM DAS', '250220@ku.ac.bd', 'student', true),
  ('250221', 'TAUFIQ E ELAHI', '250221@ku.ac.bd', 'cr', true),
  ('250222', 'FAHAD HASSAN', '250222@ku.ac.bd', 'student', true),
  ('250223', 'SHAHARIAR KOBIR', '250223@ku.ac.bd', 'student', true),
  ('250224', 'KAZI RAHAD ALI', '250224@ku.ac.bd', 'student', true),
  ('250225', 'TASNIM ISLAM', '250225@ku.ac.bd', 'student', true),
  ('250226', 'SEAM RAHMAN KABBO', '250226@ku.ac.bd', 'student', true),
  ('250228', 'MD. JUABAYED', '250228@ku.ac.bd', 'student', true),
  ('250229', 'ABDULLAH AL MAMUN', '250229@ku.ac.bd', 'student', true),
  ('250230', 'MD. MORSALIN SHAH', '250230@ku.ac.bd', 'student', true),
  ('250231', 'AFIF HOSSAIN', '250231@ku.ac.bd', 'student', true),
  ('250232', 'MALIHA AFRIN', '250232@ku.ac.bd', 'student', true),
  ('250233', 'CHOWDHURY RIFAT AHMED', '250233@ku.ac.bd', 'student', true),
  ('250234', 'MUJAHID AL MAHI', '250234@ku.ac.bd', 'student', true),
  ('250235', 'MD. SHAHARIAR HOSSAIN JIBON', '250235@ku.ac.bd', 'student', true),
  ('250236', 'ARGHA ROY', '250236@ku.ac.bd', 'acr', true),
  ('250237', 'KHONDOKER AHNAF ELAHE', '250237@ku.ac.bd', 'student', true),
  ('250238', 'ZAHIN BIN HASAN', '250238@ku.ac.bd', 'student', true),
  ('250239', 'PABITRA CHAKMA', '250239@ku.ac.bd', 'student', true),
  ('250240', 'MD. HABIBUR RAHMAN', '250240@ku.ac.bd', 'student', true),
  ('250241', 'DANISH ANSARI', '250241@ku.ac.bd', 'student', true),
  ('250242', 'RAKHI MAHATO', '250242@ku.ac.bd', 'student', true),
  ('250243', 'EVAN NIRJON', '250243@ku.ac.bd', 'student', true)
ON CONFLICT (student_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 4. PROFILES TABLE (Associated with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT profiles_role_check CHECK (role IN ('student', 'cr', 'acr')),
  CONSTRAINT profiles_student_id_check CHECK (
    student_id ~ '^2502(0[1-9]|[1-3][0-9]|4[0-3])$'
    AND student_id NOT IN ('250210', '250216', '250217', '250227')
  ),
  CONSTRAINT profiles_email_check CHECK (
    lower(email) ~ '^2502(0[1-9]|[1-3][0-9]|4[0-3])@ku\.ac\.bd$'
    AND lower(email) NOT IN ('250210@ku.ac.bd', '250216@ku.ac.bd', '250217@ku.ac.bd', '250227@ku.ac.bd')
  )
);

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. ROLE CHECKING SECURITY DEFINER HELPERS
-- Returns true if auth.uid() has CR or ACR role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('cr', 'acr')
  );
END;
$$;

-- Returns true if auth.uid() has active student, CR, or ACR profile
CREATE OR REPLACE FUNCTION public.is_active_student()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('student', 'cr', 'acr')
  );
END;
$$;

-- 6. PROFILE IMMUTABILITY & ANTI-TAMPERING TRIGGER
-- Ensures normal students cannot modify student_id, email, role, or active status
CREATE OR REPLACE FUNCTION public.prevent_profile_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check if student_id, email, role, or is_active is modified
  IF (NEW.student_id <> OLD.student_id) OR
     (lower(NEW.email) <> lower(OLD.email)) OR
     (NEW.role <> OLD.role) OR
     (NEW.is_active <> OLD.is_active) THEN
    -- Only allow if current role is service_role
    IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: Student ID, institutional email, role, and active status are immutable.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_profile_tampering ON public.profiles;
CREATE TRIGGER trigger_prevent_profile_tampering
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_tampering();

-- 7. AUTH USER LINKING TRIGGER
-- Associates auth.users(id) with authoritative KUCSE25 student roster upon registration
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_roster RECORD;
BEGIN
  -- Match verified institutional email against authoritative roster
  SELECT * INTO v_roster
  FROM public.kucse25_roster
  WHERE lower(email) = lower(NEW.email)
    AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.profiles (
      id,
      student_id,
      name,
      email,
      role,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      NEW.id,
      v_roster.student_id,
      v_roster.name,
      v_roster.email,
      v_roster.role,
      v_roster.is_active,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      student_id = EXCLUDED.student_id,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- Secure RPC to sync & fetch caller's student profile
CREATE OR REPLACE FUNCTION public.get_my_student_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_email TEXT;
  v_roster RECORD;
BEGIN
  v_user_email := auth.jwt()->>'email';

  IF v_user_email IS NULL OR auth.uid() IS NULL THEN
    RETURN;
  END IF;

  SELECT * INTO v_roster
  FROM public.kucse25_roster
  WHERE lower(email) = lower(v_user_email)
    AND is_active = true
  LIMIT 1;

  IF FOUND THEN
    INSERT INTO public.profiles (
      id,
      student_id,
      name,
      email,
      role,
      is_active,
      created_at,
      updated_at
    )
    VALUES (
      auth.uid(),
      v_roster.student_id,
      v_roster.name,
      v_roster.email,
      v_roster.role,
      v_roster.is_active,
      now(),
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      student_id = EXCLUDED.student_id,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = now();
  END IF;

  RETURN QUERY
  SELECT *
  FROM public.profiles
  WHERE id = auth.uid()
    AND is_active = true;
END;
$$;

-- 8. RESOURCES TABLE
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT,
  storage_path TEXT,
  resource_type TEXT NOT NULL,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  download_count INTEGER NOT NULL DEFAULT 0,
  original_size_bytes BIGINT,
  optimized_size_bytes BIGINT,
  file_hash TEXT,
  mime_type TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT resources_status_check CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  CONSTRAINT resources_download_count_check CHECK (download_count >= 0),
  CONSTRAINT resources_resource_type_check CHECK (
    resource_type IN (
      'Lecture Slide',
      'Lecture Note',
      'Lab',
      'Assignment',
      'Question',
      'Solution',
      'Cheat Sheet',
      'Other'
    )
  )
);

DROP TRIGGER IF EXISTS set_resources_updated_at ON public.resources;
CREATE TRIGGER set_resources_updated_at
  BEFORE UPDATE ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 9. RESOURCE SUBMISSION VALIDATION & FORCE PENDING TRIGGER
-- Forces status = 'pending', download_count = 0, uploader_id = auth.uid()
CREATE OR REPLACE FUNCTION public.force_pending_resource_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Authentication required to submit resources.';
    END IF;
    -- Database binds uploader to verified auth identity
    NEW.uploader_id := auth.uid();
    NEW.status := 'pending';
    NEW.download_count := 0;
    NEW.reviewed_by := NULL;
    NEW.reviewed_at := NULL;
    NEW.rejection_reason := NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_force_pending_resource_on_insert ON public.resources;
CREATE TRIGGER trigger_force_pending_resource_on_insert
  BEFORE INSERT ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.force_pending_resource_on_insert();

-- 10. RESOURCE APPROVAL STATE TRANSITION TRIGGER
-- Strictly enforces allowable state machine transitions:
-- pending -> approved | rejected
-- approved -> archived
-- rejected -> archived
CREATE OR REPLACE FUNCTION public.enforce_resource_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- If status is not changing, allow update (e.g. download count increment)
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;

  -- Only CR/ACR (or service_role) can change status
  IF NOT public.is_admin() AND
     current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Only Class Representatives (CR/ACR) can modify resource status.';
  END IF;

  -- Validate state machine transitions
  IF OLD.status = 'pending' AND NEW.status NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid status transition: Pending resources can only be moved to approved or rejected.';
  ELSIF OLD.status = 'approved' AND NEW.status NOT IN ('archived') THEN
    RAISE EXCEPTION 'Invalid status transition: Approved resources can only be moved to archived.';
  ELSIF OLD.status = 'rejected' AND NEW.status NOT IN ('archived') THEN
    RAISE EXCEPTION 'Invalid status transition: Rejected resources can only be archived.';
  ELSIF OLD.status = 'archived' THEN
    RAISE EXCEPTION 'Invalid status transition: Archived resources cannot change status.';
  END IF;

  -- Auto-populate review audit trail
  IF NEW.status IN ('approved', 'rejected', 'archived') THEN
    NEW.reviewed_at := now();
    NEW.reviewed_by := COALESCE(NEW.reviewed_by, auth.uid());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_enforce_resource_status_transition ON public.resources;
CREATE TRIGGER trigger_enforce_resource_status_transition
  BEFORE UPDATE OF status ON public.resources
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_resource_status_transition();

-- 11. ATOMIC DOWNLOAD COUNTER RPC
CREATE OR REPLACE FUNCTION public.increment_download(res_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_count INTEGER;
BEGIN
  IF res_id IS NULL THEN
    RAISE EXCEPTION 'Resource ID must not be null.';
  END IF;

  -- Verify existence and status = 'approved', then increment atomically in a single statement
  UPDATE public.resources
  SET download_count = download_count + 1
  WHERE id = res_id
    AND status = 'approved'
  RETURNING download_count INTO v_new_count;

  IF v_new_count IS NULL THEN
    RAISE EXCEPTION 'Resource not found or is not approved for download.';
  END IF;

  RETURN v_new_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.increment_download(UUID) TO anon, authenticated;

-- 12. PUBLIC PRIVACY VIEW
-- Exposes ONLY approved resources and uploader display names.
-- Zero exposure of uploader email, student ID, internal storage paths, or moderation audit data.
CREATE OR REPLACE VIEW public.public_resources AS
SELECT
  r.id,
  r.course_id,
  r.original_filename,
  r.original_filename AS filename,
  r.resource_type,
  p.name AS uploader_name,
  r.download_count,
  r.original_size_bytes,
  r.mime_type,
  r.created_at,
  r.status
FROM public.resources r
JOIN public.profiles p ON r.uploader_id = p.id
WHERE r.status = 'approved';

-- 13. INDEXES FOR QUERY OPTIMIZATION
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_course_id ON public.resources(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_resource_type ON public.resources(resource_type);
CREATE INDEX IF NOT EXISTS idx_resources_uploader_id ON public.resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_download_count ON public.resources(download_count DESC);
CREATE INDEX IF NOT EXISTS idx_resources_course_status ON public.resources(course_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_student_id ON public.profiles(student_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(email));
CREATE INDEX IF NOT EXISTS idx_roster_email ON public.kucse25_roster(lower(email));

-- 14. ROW LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE public.kucse25_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- 15. RLS POLICIES FOR kucse25_roster
DROP POLICY IF EXISTS "Admins can view roster directory" ON public.kucse25_roster;
CREATE POLICY "Admins can view roster directory"
  ON public.kucse25_roster
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- 16. RLS POLICIES FOR profiles
-- A: Student can SELECT only their own profile
DROP POLICY IF EXISTS "Students can view own profile" ON public.profiles;
CREATE POLICY "Students can view own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- B: CR/ACR can view all profiles for moderation & batch administration
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- C: Public can resolve uploader names for approved resources (for relational queries)
DROP POLICY IF EXISTS "Public can view approved resource uploader names" ON public.profiles;
CREATE POLICY "Public can view approved resource uploader names"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.resources r
      WHERE r.uploader_id = profiles.id
        AND r.status = 'approved'
    )
  );

-- D: Student can UPDATE own profile name (anti-tampering trigger protects other columns)
DROP POLICY IF EXISTS "Students can update own profile" ON public.profiles;
CREATE POLICY "Students can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 17. RLS POLICIES FOR resources
-- A: Public can view ONLY approved resources
DROP POLICY IF EXISTS "Public can view approved resources" ON public.resources;
CREATE POLICY "Public can view approved resources"
  ON public.resources
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- B: Authenticated students can view their own submissions (pending, approved, rejected, archived)
DROP POLICY IF EXISTS "Students can view own submissions" ON public.resources;
CREATE POLICY "Students can view own submissions"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (uploader_id = auth.uid());

-- C: CR/ACR can view all resources in any status
DROP POLICY IF EXISTS "Admins can view all resources" ON public.resources;
CREATE POLICY "Admins can view all resources"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- D: Authenticated students can insert pending submissions
DROP POLICY IF EXISTS "Students can insert pending submissions" ON public.resources;
CREATE POLICY "Students can insert pending submissions"
  ON public.resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND status = 'pending'
    AND public.is_active_student()
  );

-- E: Only CR/ACR can update resources (approve, reject, archive)
DROP POLICY IF EXISTS "Admins can update resources" ON public.resources;
CREATE POLICY "Admins can update resources"
  ON public.resources
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 18. STORAGE BUCKET CONFIGURATION & STORAGE RLS
-- Create private 'resources' bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources',
  'resources',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/png',
    'image/jpeg',
    'application/zip',
    'application/x-zip-compressed',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage Policy 1: Authenticated students can upload files to 'resources'
DROP POLICY IF EXISTS "Authenticated students can upload resource files" ON storage.objects;
CREATE POLICY "Authenticated students can upload resource files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resources'
    AND public.is_active_student()
  );

-- Storage Policy 2: CR/ACR can view any file for moderation
DROP POLICY IF EXISTS "Admins can view any resource object" ON storage.objects;
CREATE POLICY "Admins can view any resource object"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND public.is_admin()
  );

-- Storage Policy 3: Students can read their own uploads and approved resource files
DROP POLICY IF EXISTS "Students and users can read resource objects" ON storage.objects;
CREATE POLICY "Students and users can read resource objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.resources r
        WHERE r.storage_path = name
          AND (r.uploader_id = auth.uid() OR r.status = 'approved')
      )
    )
  );

-- Storage Policy 4: Only CR/ACR can delete files
DROP POLICY IF EXISTS "Only admins can delete resource files" ON storage.objects;
CREATE POLICY "Only admins can delete resource files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND public.is_admin()
  );
