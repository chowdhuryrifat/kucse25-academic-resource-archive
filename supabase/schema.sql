-- ==============================================================================
-- KUCSE25 ACADEMIC RESOURCE ARCHIVE - SUPABASE DATABASE SCHEMA & RLS POLICIES
-- Batch 25, Department of Computer Science & Engineering, Khulna University
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STUDENTS ROSTER TABLE (Authoritative Whitelist Directory)
-- Seeded with all 39 active students of KUCSE25 (Rolls 01 to 43, excluding 10, 16, 17, 27)
CREATE TABLE IF NOT EXISTS public.students_roster (
  student_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'cr', 'acr')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed authoritative KUCSE25 Roster
INSERT INTO public.students_roster (student_id, name, email, role, is_active)
VALUES
  ('250201', 'Abdullah Al Mamun', '250201@ku.ac.bd', 'student', true),
  ('250202', 'Fahim Muntashir', '250202@ku.ac.bd', 'student', true),
  ('250203', 'Nusrat Jahan', '250203@ku.ac.bd', 'student', true),
  ('250204', 'Sabbir Hossain', '250204@ku.ac.bd', 'student', true),
  ('250205', 'Tanvir Hossain', '250205@ku.ac.bd', 'cr', true),
  ('250206', 'Mehedi Hasan', '250206@ku.ac.bd', 'student', true),
  ('250207', 'Sadia Afrin', '250207@ku.ac.bd', 'student', true),
  ('250208', 'Kazi Rayhan', '250208@ku.ac.bd', 'student', true),
  ('250209', 'Arafat Rahman', '250209@ku.ac.bd', 'student', true),
  ('250211', 'Farhan Kabir', '250211@ku.ac.bd', 'student', true),
  ('250212', 'Tahmidul Islam', '250212@ku.ac.bd', 'acr', true),
  ('250213', 'Anika Tabassum', '250213@ku.ac.bd', 'student', true),
  ('250214', 'Shahadat Hossain', '250214@ku.ac.bd', 'student', true),
  ('250215', 'Rakibul Islam', '250215@ku.ac.bd', 'student', true),
  ('250218', 'Mahfuzur Rahman', '250218@ku.ac.bd', 'student', true),
  ('250219', 'Shakil Ahmed', '250219@ku.ac.bd', 'student', true),
  ('250220', 'Nafis Imtiaz', '250220@ku.ac.bd', 'student', true),
  ('250221', 'Tasnim Hasan', '250221@ku.ac.bd', 'student', true),
  ('250222', 'Joyonto Roy', '250222@ku.ac.bd', 'student', true),
  ('250223', 'Nazmul Huda', '250223@ku.ac.bd', 'student', true),
  ('250224', 'Sumaiya Akter', '250224@ku.ac.bd', 'student', true),
  ('250225', 'Hasan Mahmud', '250225@ku.ac.bd', 'student', true),
  ('250226', 'Ariful Islam', '250226@ku.ac.bd', 'student', true),
  ('250228', 'Zarin Subah', '250228@ku.ac.bd', 'student', true),
  ('250229', 'Sourav Das', '250229@ku.ac.bd', 'student', true),
  ('250230', 'Muntasir Billah', '250230@ku.ac.bd', 'student', true),
  ('250231', 'Ashraful Alam', '250231@ku.ac.bd', 'student', true),
  ('250232', 'Sharmin Sultana', '250232@ku.ac.bd', 'student', true),
  ('250233', 'Rifat Ahmed', '250233@ku.ac.bd', 'student', true),
  ('250234', 'Dipankar Biswas', '250234@ku.ac.bd', 'student', true),
  ('250235', 'Tamanna Ferdous', '250235@ku.ac.bd', 'student', true),
  ('250236', 'Shahriar Shuvo', '250236@ku.ac.bd', 'student', true),
  ('250237', 'Nayeem Hasan', '250237@ku.ac.bd', 'student', true),
  ('250238', 'Protik Mukherjee', '250238@ku.ac.bd', 'student', true),
  ('250239', 'Sajib Paul', '250239@ku.ac.bd', 'student', true),
  ('250240', 'Kazi Tahsin', '250240@ku.ac.bd', 'student', true),
  ('250241', 'Rezwanul Haque', '250241@ku.ac.bd', 'student', true),
  ('250242', 'Mahrus Hossain', '250242@ku.ac.bd', 'student', true),
  ('250243', 'Samiul Alim', '250243@ku.ac.bd', 'student', true)
ON CONFLICT (student_id) DO UPDATE SET
  name = EXCLUDED.name,
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active;

-- 3. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'cr', 'acr')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger to automatically create/update profile from students_roster when a user authenticates
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  roster_rec RECORD;
BEGIN
  -- Validate against authoritative roster
  SELECT * INTO roster_rec FROM public.students_roster
  WHERE LOWER(email) = LOWER(NEW.email) AND is_active = true;

  IF FOUND THEN
    INSERT INTO public.profiles (id, student_id, name, email, role, is_active)
    VALUES (NEW.id, roster_rec.student_id, roster_rec.name, LOWER(NEW.email), roster_rec.role, true)
    ON CONFLICT (id) DO UPDATE SET
      student_id = EXCLUDED.student_id,
      name = EXCLUDED.name,
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      is_active = EXCLUDED.is_active,
      updated_at = now();
  ELSE
    -- Non-whitelisted email: store with inactive status preventing resource operations
    INSERT INTO public.profiles (id, student_id, name, email, role, is_active)
    VALUES (NEW.id, 'UNAUTHORIZED', 'Non-Batch Member', LOWER(NEW.email), 'student', false)
    ON CONFLICT (id) DO UPDATE SET
      is_active = false,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. RESOURCES TABLE
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  stored_filename TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'archived')),
  download_count INTEGER NOT NULL DEFAULT 0,
  original_size_bytes BIGINT NOT NULL DEFAULT 0,
  optimized_size_bytes BIGINT NOT NULL DEFAULT 0,
  file_hash TEXT,
  mime_type TEXT,
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast search & filtering
CREATE INDEX IF NOT EXISTS idx_resources_status ON public.resources(status);
CREATE INDEX IF NOT EXISTS idx_resources_course_id ON public.resources(course_id);
CREATE INDEX IF NOT EXISTS idx_resources_uploader_id ON public.resources(uploader_id);
CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);

-- 5. ATOMIC DOWNLOAD COUNTER RPC
CREATE OR REPLACE FUNCTION public.increment_download(res_id UUID)
RETURNS INTEGER AS $$
DECLARE
  new_count INTEGER;
BEGIN
  UPDATE public.resources
  SET download_count = download_count + 1
  WHERE id = res_id AND status = 'approved'
  RETURNING download_count INTO new_count;

  RETURN COALESCE(new_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. PUBLIC PRIVACY VIEW (Enforces Public Access Boundary)
-- Strips uploader email, student ID, storage paths, rejection reasons, and audit trails
CREATE OR REPLACE VIEW public.public_resources AS
SELECT
  r.id,
  r.course_id,
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

-- 7. HELPER FUNCTIONS FOR ROW LEVEL SECURITY (RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('cr', 'acr')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_active_student()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND is_active = true
      AND role IN ('student', 'cr', 'acr')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 8. ROW LEVEL SECURITY (RLS) ACTIVATION
ALTER TABLE public.students_roster ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- 9. RLS POLICIES FOR students_roster
CREATE POLICY "Public can view roster directory for name verification"
  ON public.students_roster
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 10. RLS POLICIES FOR profiles
CREATE POLICY "Public can read active profiles for uploader names"
  ON public.profiles
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

CREATE POLICY "Users can update own profile name"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 11. RLS POLICIES FOR resources
-- A: Public SELECT of approved resources
CREATE POLICY "Public can view approved resources"
  ON public.resources
  FOR SELECT
  TO anon, authenticated
  USING (status = 'approved');

-- B: Authenticated active students creating pending submissions
-- Enforces: uploader_id MUST match auth.uid(), status MUST be 'pending'
CREATE POLICY "Active students can insert pending submissions"
  ON public.resources
  FOR INSERT
  TO authenticated
  WITH CHECK (
    uploader_id = auth.uid()
    AND status = 'pending'
    AND public.is_active_student()
  );

-- C: Students can view their own submissions (even if pending/rejected)
CREATE POLICY "Students can view their own submissions"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    uploader_id = auth.uid()
  );

-- D: CR/ACR can view all resources (pending, rejected, archived)
CREATE POLICY "Admins can view all resources"
  ON public.resources
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
  );

-- E: CR/ACR can update resources (approve, reject with feedback, archive)
CREATE POLICY "Admins can update resources"
  ON public.resources
  FOR UPDATE
  TO authenticated
  USING (
    public.is_admin()
  )
  WITH CHECK (
    public.is_admin()
  );

-- 12. STORAGE BUCKET CONFIGURATION
-- Create private 'resources' bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Storage RLS: Authenticated students can upload into the bucket
CREATE POLICY "Authenticated students can upload files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'resources'
    AND public.is_active_student()
  );

-- Storage RLS: Admin access to all files; Students access own uploaded files
CREATE POLICY "Users and admins can read objects via signed URLs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'resources'
    AND (public.is_admin() OR auth.uid()::text = (storage.foldername(name))[1])
  );
