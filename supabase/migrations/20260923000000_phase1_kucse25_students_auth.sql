-- ==============================================================================
-- KUCSE25 PHASE 1: AUTHENTICATION & STUDENT ROSTER MIGRATION
-- Batch 25, Department of Computer Science & Engineering, Khulna University
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. STUDENTS TABLE (Authoritative Roster & Auth Profile)
CREATE TABLE IF NOT EXISTS public.students (
  student_id TEXT PRIMARY KEY,
  id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'cr', 'acr')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexing for fast and secure query resolution
CREATE INDEX IF NOT EXISTS idx_students_id ON public.students(id);
CREATE INDEX IF NOT EXISTS idx_students_email ON public.students(lower(email));
CREATE INDEX IF NOT EXISTS idx_students_role ON public.students(role);

-- 3. SEED AUTHORITATIVE KUCSE25 ROSTER (All 39 active batch members)
-- Rolls 01 to 43, excluding 10, 16, 17, 27
-- CR: 250221 (TAUFIQ E ELAHI), ACR: 250236 (ARGHA ROY)
INSERT INTO public.students (student_id, name, email, role, is_active)
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

-- 4. DATABASE-SIDE TRIGGER: LINK AUTH USERS TO PRE-SEEDED ROSTER
-- Strictly links auth.users to the authoritative KUCSE25 student by verified email
CREATE OR REPLACE FUNCTION public.link_auth_user_to_student()
RETURNS TRIGGER AS $$
BEGIN
  -- Match by lowercase institutional email
  UPDATE public.students
  SET id = NEW.id,
      updated_at = now()
  WHERE lower(email) = lower(NEW.email)
    AND is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE OF email ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.link_auth_user_to_student();

-- 5. SECURE RPC TO SYNC & FETCH CURRENT USER PROFILE
-- This ensures that even if user existed prior to migration or trigger,
-- calling this securely links id = auth.uid() using the verified JWT email.
CREATE OR REPLACE FUNCTION public.get_my_student_profile()
RETURNS SETOF public.students AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  v_user_email := auth.jwt()->>'email';

  IF v_user_email IS NULL THEN
    RETURN;
  END IF;

  -- Authoritative database-side linking using verified JWT claims
  UPDATE public.students
  SET id = auth.uid(),
      updated_at = now()
  WHERE (id IS NULL OR id != auth.uid())
    AND lower(email) = lower(v_user_email)
    AND is_active = true;

  RETURN QUERY
  SELECT *
  FROM public.students
  WHERE id = auth.uid()
    AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- Policy 1: Authenticated students can read ONLY their own profile
CREATE POLICY "Students can view own profile"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid() OR lower(email) = lower(auth.jwt()->>'email')
  );

-- Policy 2: Class Representatives (CR / ACR) can read the roster for batch moderation
CREATE POLICY "Representatives can view roster"
  ON public.students
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.students s
      WHERE s.id = auth.uid()
        AND s.role IN ('cr', 'acr')
        AND s.is_active = true
    )
  );

-- Policy 3: Public / Anonymous visitors CANNOT read the student roster
-- (By default, no policy exists for 'anon', so public reads return 0 rows)

-- Policy 4: Students CANNOT insert, update, or delete profiles from client
-- Identity, roles, student IDs, and names are strictly immutable from client code
-- Any administrative edits must be performed via Supabase Dashboard or Service Role
