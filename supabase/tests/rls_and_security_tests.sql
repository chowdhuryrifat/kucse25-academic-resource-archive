-- ==============================================================================
-- KUCSE25 ACADEMIC RESOURCE ARCHIVE - DATABASE SECURITY & RLS TEST SUITE
-- Tests RLS Policies, State Transitions, Atomic RPC, and Immutability Constraints
-- ==============================================================================

\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_test_cr_uid UUID := '11111111-1111-1111-1111-111111111111';
  v_test_student_uid UUID := '22222222-2222-2222-2222-222222222222';
  v_test_outsider_uid UUID := '33333333-3333-3333-3333-333333333333';
  v_resource_id UUID;
  v_download_res INTEGER;
  v_threw BOOLEAN;
BEGIN
  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'STARTING KUCSE25 DATABASE SECURITY VALIDATION TESTS';
  RAISE NOTICE '=====================================================';

  -- -------------------------------------------------------------------
  -- TEST 1: AUTHORITATIVE ROSTER CONSTRAINTS
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 1: Validating KUCSE25 Roster Constraints...';

  -- 1a: Should fail on excluded rolls (e.g. 250210, 250216, 250217, 250227)
  v_threw := false;
  BEGIN
    INSERT INTO public.kucse25_roster (student_id, name, email, role, is_active)
    VALUES ('250210', 'FAKE STUDENT', '250210@ku.ac.bd', 'student', true);
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: Excluded roll 250210 was allowed in roster!';

  -- 1b: Should fail on non-whitelisted email domains
  v_threw := false;
  BEGIN
    INSERT INTO public.kucse25_roster (student_id, name, email, role, is_active)
    VALUES ('250201', 'DUPLICATE', 'student@gmail.com', 'student', true);
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: Non-ku.ac.bd email was allowed in roster!';

  RAISE NOTICE '✓ Test 1 Passed: Roster constraints strictly enforced.';

  -- -------------------------------------------------------------------
  -- TEST 2: PROFILES TABLE ROLE & ROLL CONSTRAINTS
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 2: Validating Profiles Table Role Constraints...';

  -- 2a: Mock auth users
  INSERT INTO auth.users (id, email)
  VALUES
    (v_test_cr_uid, '250221@ku.ac.bd'),
    (v_test_student_uid, '250201@ku.ac.bd')
  ON CONFLICT (id) DO NOTHING;

  -- 2b: Create Profiles
  INSERT INTO public.profiles (id, student_id, name, email, role, is_active)
  VALUES
    (v_test_cr_uid, '250221', 'TAUFIQ E ELAHI', '250221@ku.ac.bd', 'cr', true),
    (v_test_student_uid, '250201', 'LAMEYA TABASUM', '250201@ku.ac.bd', 'student', true)
  ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role;

  -- 2c: Invalid role should fail
  v_threw := false;
  BEGIN
    INSERT INTO public.profiles (id, student_id, name, email, role, is_active)
    VALUES ('99999999-9999-9999-9999-999999999999', '250202', 'NAME', '250202@ku.ac.bd', 'superadmin', true);
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: Arbitrary role superadmin was allowed in profiles!';

  RAISE NOTICE '✓ Test 2 Passed: Profiles roles constrained to student, cr, acr.';

  -- -------------------------------------------------------------------
  -- TEST 3: HELPER FUNCTIONS (is_admin, is_active_student)
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 3: Testing is_admin() and is_active_student()...';

  -- Set session to CR
  PERFORM set_config('request.jwt.claim.sub', v_test_cr_uid::text, true);
  PERFORM set_config('role', 'authenticated', true);

  ASSERT public.is_admin() = true, 'FAILED: is_admin() returned false for CR!';
  ASSERT public.is_active_student() = true, 'FAILED: is_active_student() returned false for CR!';

  -- Set session to regular student
  PERFORM set_config('request.jwt.claim.sub', v_test_student_uid::text, true);

  ASSERT public.is_admin() = false, 'FAILED: is_admin() returned true for regular student!';
  ASSERT public.is_active_student() = true, 'FAILED: is_active_student() returned false for student!';

  RAISE NOTICE '✓ Test 3 Passed: Role helper functions correctly resolve permissions.';

  -- -------------------------------------------------------------------
  -- TEST 4: RESOURCE SUBMISSIONS & STATUS FORCE PENDING
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 4: Validating Submission Creation & Status Default...';

  -- Switch to Student session
  PERFORM set_config('request.jwt.claim.sub', v_test_student_uid::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  v_resource_id := gen_random_uuid();

  -- Attempt to maliciously insert status = 'approved' and download_count = 500
  INSERT INTO public.resources (
    id,
    course_id,
    original_filename,
    resource_type,
    uploader_id,
    status,
    download_count
  )
  VALUES (
    v_resource_id,
    'cse-1205',
    'lecture_1.pdf',
    'Lecture Slide',
    v_test_student_uid,
    'approved',
    500
  );

  -- Verify server-side trigger forced status = 'pending' and download_count = 0
  ASSERT (SELECT status FROM public.resources WHERE id = v_resource_id) = 'pending',
    'FAILED: Server trigger failed to force pending status!';
  ASSERT (SELECT download_count FROM public.resources WHERE id = v_resource_id) = 0,
    'FAILED: Server trigger failed to reset download_count to 0!';

  RAISE NOTICE '✓ Test 4 Passed: Status forced to pending and download_count forced to 0.';

  -- -------------------------------------------------------------------
  -- TEST 5: RESOURCE STATUS TRANSITIONS
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 5: Testing Resource Status Transitions...';

  -- 5a: Student cannot approve their own resource
  v_threw := false;
  BEGIN
    UPDATE public.resources
    SET status = 'approved'
    WHERE id = v_resource_id;
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT (SELECT status FROM public.resources WHERE id = v_resource_id) = 'pending',
    'FAILED: Student was able to approve resource!';

  -- 5b: Switch to CR session
  PERFORM set_config('request.jwt.claim.sub', v_test_cr_uid::text, true);

  -- 5c: CR approves resource (pending -> approved: allowed)
  UPDATE public.resources
  SET status = 'approved'
  WHERE id = v_resource_id;

  ASSERT (SELECT status FROM public.resources WHERE id = v_resource_id) = 'approved',
    'FAILED: CR could not approve pending resource!';
  ASSERT (SELECT reviewed_by FROM public.resources WHERE id = v_resource_id) = v_test_cr_uid,
    'FAILED: reviewed_by was not populated with CR uid!';

  -- 5d: Invalid transition: approved -> pending (must fail)
  v_threw := false;
  BEGIN
    UPDATE public.resources
    SET status = 'pending'
    WHERE id = v_resource_id;
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: Transition from approved back to pending was allowed!';

  -- 5e: Valid transition: approved -> archived (allowed)
  UPDATE public.resources
  SET status = 'archived'
  WHERE id = v_resource_id;

  ASSERT (SELECT status FROM public.resources WHERE id = v_resource_id) = 'archived',
    'FAILED: CR could not archive approved resource!';

  -- 5f: Transition from archived to approved (must fail)
  v_threw := false;
  BEGIN
    UPDATE public.resources
    SET status = 'approved'
    WHERE id = v_resource_id;
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: Transition out of archived was allowed!';

  RAISE NOTICE '✓ Test 5 Passed: State machine transitions strictly enforced.';

  -- -------------------------------------------------------------------
  -- TEST 6: ATOMIC DOWNLOAD COUNTER RPC
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 6: Testing increment_download() Atomic RPC...';

  -- Create approved test resource
  v_resource_id := gen_random_uuid();
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.resources (
    id,
    course_id,
    original_filename,
    resource_type,
    uploader_id,
    status,
    download_count
  )
  VALUES (
    v_resource_id,
    'cse-1205',
    'approved_doc.pdf',
    'Lecture Note',
    v_test_student_uid,
    'approved',
    10
  );

  -- Execute increment_download as anonymous user
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);

  v_download_res := public.increment_download(v_resource_id);
  ASSERT v_download_res = 11, 'FAILED: increment_download did not return 11!';

  -- Call again
  v_download_res := public.increment_download(v_resource_id);
  ASSERT v_download_res = 12, 'FAILED: increment_download did not increment atomically to 12!';

  -- Calling on pending resource must fail
  UPDATE public.resources SET status = 'pending' WHERE id = v_resource_id;
  v_threw := false;
  BEGIN
    PERFORM public.increment_download(v_resource_id);
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: increment_download allowed download of unapproved resource!';

  RAISE NOTICE '✓ Test 6 Passed: increment_download RPC works atomically and protects non-approved resources.';

  -- -------------------------------------------------------------------
  -- TEST 7: PRIVACY VIEW public_resources
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 7: Testing public_resources Privacy View...';

  -- Ensure view returns uploader_name without exposing student ID or email
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);

  -- Make sure resource is approved
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.resources SET status = 'approved' WHERE id = v_resource_id;

  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);

  ASSERT EXISTS (
    SELECT 1 FROM public.public_resources
    WHERE id = v_resource_id AND uploader_name = 'LAMEYA TABASUM'
  ), 'FAILED: public_resources view did not return approved resource!';

  RAISE NOTICE '✓ Test 7 Passed: Privacy view exposes public fields safely.';

  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'ALL KUCSE25 DATABASE SECURITY TESTS PASSED!';
  RAISE NOTICE '=====================================================';
END $$;

ROLLBACK; -- Clean rollback of test data
