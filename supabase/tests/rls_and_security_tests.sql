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
  v_resource_id2 UUID;
  v_download_res INTEGER;
  v_threw BOOLEAN;
  v_reservation_id UUID;
  v_reserved UUID;
  v_n BIGINT;
  v_committed_baseline BIGINT;
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
    stored_filename,
    storage_path,
    resource_type,
    uploader_id,
    status,
    download_count,
    original_size_bytes,
    optimized_size_bytes
  )
  VALUES (
    v_resource_id,
    'cse-1205',
    'lecture_1.pdf',
    'lecture_1.pdf',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/lecture_1.pdf',
    'Lecture Slide',
    v_test_student_uid,
    'approved',
    500,
    2048,
    1024
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
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.resources (
    id,
    course_id,
    original_filename,
    stored_filename,
    storage_path,
    resource_type,
    uploader_id,
    status,
    download_count,
    original_size_bytes,
    optimized_size_bytes
  )
  VALUES (
    v_resource_id,
    'cse-1205',
    'approved_doc.pdf',
    'approved_doc.pdf',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/approved_doc.pdf',
    'Lecture Note',
    v_test_student_uid,
    'approved',
    10,
    4096,
    2048
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

  -- Calling on a NON-approved (pending) resource must fail
  v_resource_id2 := gen_random_uuid();
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  INSERT INTO public.resources (
    id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, original_size_bytes, optimized_size_bytes
  ) VALUES (
    v_resource_id2, 'cse-1205', 'pending_doc.pdf', 'pending_doc.pdf',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/pending_doc.pdf',
    'Lecture Note', v_test_student_uid, 'pending', 100, 100
  );
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  v_threw := false;
  BEGIN
    PERFORM public.increment_download(v_resource_id2);
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
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.resources SET status = 'approved' WHERE id = v_resource_id;

  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);

  ASSERT EXISTS (
    SELECT 1 FROM public.public_resources
    WHERE id = v_resource_id AND uploader_name = 'LAMEYA TABASUM'
  ), 'FAILED: public_resources view did not return approved resource!';

  RAISE NOTICE '✓ Test 7 Passed: Privacy view exposes public fields safely.';

  -- -------------------------------------------------------------------
  -- TEST 8: STORAGE RLS - ON-DEMAND SIGNED URL ACCESS (APPROVED ONLY)
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 8: Testing storage.objects read policy for signed URLs...';

  -- Give the approved resource a storage_object backing path
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.resources
  SET status = 'approved',
      storage_path = '99999999-9999-9999-9999-999999999999/original.pdf'
  WHERE id = v_resource_id;
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES (
    'resources',
    '99999999-9999-9999-9999-999999999999/original.pdf',
    v_test_student_uid,
    '{"size":1000,"mimetype":"application/pdf"}'::jsonb
  );

  -- As anonymous (public) role: the approved object must be resolvable
  -- so createSignedUrl can issue an on-demand signed URL.
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  ASSERT (
    SELECT count(*) FROM storage.objects
    WHERE bucket_id = 'resources'
      AND name = '99999999-9999-9999-9999-999999999999/original.pdf'
  ) = 1, 'FAILED: anon could not resolve approved storage object for signed URL!';

  -- Once the resource no longer exists (e.g. moderation removal), the object
  -- must be hidden from anon: the approved-only read policy ties storage
  -- visibility to an existing approved resources row.
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  DELETE FROM public.resources WHERE id = v_resource_id;

  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  ASSERT (
    SELECT count(*) FROM storage.objects
    WHERE bucket_id = 'resources'
      AND name = '99999999-9999-9999-9999-999999999999/original.pdf'
  ) = 0, 'FAILED: anon could resolve a NON-approved storage object!';

  RAISE NOTICE '✓ Test 8 Passed: on-demand signed URL access is approved-only.';

  -- -------------------------------------------------------------------
  -- TEST 9: STORAGE UPLOAD POLICY - CANONICAL PATH LAYOUT ENFORCED
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 9: Testing storage.objects upload path hardening...';

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_student_uid::text, true);

  -- Canonical <uuid>/<sanitized-filename> layout is accepted
  INSERT INTO storage.objects (bucket_id, name, owner, metadata)
  VALUES (
    'resources',
    'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/lecture_2.pdf',
    v_test_student_uid,
    '{"size":500,"mimetype":"application/pdf"}'::jsonb
  );

  -- Arbitrary non-canonical path at bucket root must be rejected
  v_threw := false;
  BEGIN
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES (
      'resources',
      'malicious-root-file.pdf',
      v_test_student_uid,
      '{"size":500,"mimetype":"application/pdf"}'::jsonb
    );
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: upload with a non-canonical storage path was allowed!';

  RAISE NOTICE '✓ Test 9 Passed: upload paths restricted to canonical resource layout.';

  -- -------------------------------------------------------------------
  -- TEST 10: ATOMIC STORAGE QUOTA RESERVATION (VALID + CEILING)
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 10: Testing reserve_storage valid + ceiling behaviour...';

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_student_uid::text, true);

  -- 10a: Valid reservation succeeds and returns a reservation id in the table
  v_reservation_id := public.reserve_storage(1024);
  ASSERT v_reservation_id IS NOT NULL, 'FAILED: reserve_storage returned NULL for a valid reservation!';
  ASSERT EXISTS (
    SELECT 1 FROM public.storage_reservations
    WHERE id = v_reservation_id AND reserved_bytes = 1024 AND user_id = v_test_student_uid
  ), 'FAILED: reservation row was not persisted!';

  -- 10b: Over-ceiling reservation must be rejected (strict 800 MB ceiling)
  v_threw := false;
  BEGIN
    PERFORM public.reserve_storage(838860800);
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: over-ceiling reservation was allowed!';

  -- 10c: Release frees the reservation so downstream quota checks pass
  PERFORM public.release_storage_reservation(v_reservation_id);
  ASSERT NOT EXISTS (
    SELECT 1 FROM public.storage_reservations WHERE id = v_reservation_id
  ), 'FAILED: reservation was not released!';

  RAISE NOTICE '✓ Test 10 Passed: quota reservation is atomic, crowned, and releasable.';

  -- -------------------------------------------------------------------
  -- TEST 11: DB-AUTHORITATIVE DUPLICATE HASH (PARTIAL UNIQUE INDEX)
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 11: Testing duplicate file_hash partial unique index...';

  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- 11a: First active row with a hash is accepted
  INSERT INTO public.resources (
    id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, original_size_bytes, optimized_size_bytes
  ) VALUES (
    gen_random_uuid(), 'cse-1205', 'dup_a.pdf', 'dup_a.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dup_a.pdf', 'Lecture Note', v_test_student_uid, 'pending', 'dup-test-hash-1', 1024, 512
  );

  -- 11b: Second ACTIVE row with the same hash must be rejected (unique_violation)
  v_threw := false;
  BEGIN
    INSERT INTO public.resources (
      id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, original_size_bytes, optimized_size_bytes
    ) VALUES (
      gen_random_uuid(), 'cse-1205', 'dup_b.pdf', 'dup_b.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dup_b.pdf', 'Lecture Note', v_test_student_uid, 'pending', 'dup-test-hash-1', 1024, 512
    );
  EXCEPTION WHEN unique_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: duplicate active file_hash bypassed the unique index!';

  -- 11c: check_duplicate_hash resolves the active hash
  ASSERT public.check_duplicate_hash('dup-test-hash-1') = true,
    'FAILED: check_duplicate_hash did not detect existing active hash!';
  ASSERT public.check_duplicate_hash('nonexistent-hash') = false,
    'FAILED: check_duplicate_hash flagged a non-existent hash!';

  -- 11d: Once the original is rejected (outside the partial index), the hash is free again
  UPDATE public.resources SET status = 'rejected' WHERE file_hash = 'dup-test-hash-1';
  INSERT INTO public.resources (
    id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, original_size_bytes, optimized_size_bytes
  ) VALUES (
    gen_random_uuid(), 'cse-1205', 'dup_a_retry.pdf', 'dup_a_retry.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/dup_a_retry.pdf', 'Lecture Note', v_test_student_uid, 'pending', 'dup-test-hash-1', 1024, 512
  );
  ASSERT public.check_duplicate_hash('dup-test-hash-1') = true,
    'FAILED: re-activating a previously rejected hash was not recorded!';

  RAISE NOTICE '✓ Test 11 Passed: duplicate detection is DB-authoritative via partial unique index.';

  -- -------------------------------------------------------------------
  -- TEST 12: DOWNLOAD COUNTER REJECTS NONEXISTENT RESOURCE
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 12: Testing increment_download on a nonexistent resource...';

  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claim.role', 'anon', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  v_threw := false;
  BEGIN
    PERFORM public.increment_download('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: increment_download did not fail for a nonexistent resource!';

  RAISE NOTICE '✓ Test 12 Passed: increment_download fails atomically for nonexistent resources.';

  -- -------------------------------------------------------------------
  -- TEST 13: PER-FORMAT SIZE-LIMIT CHECK CONSTRAINT (PHASE 6)
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 13: Testing resources_size_limits_check (per-format size limits)...';

  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- 13a: Large PDF input (20 MB) + stored (10 MB) accepted at the DB boundary
  INSERT INTO public.resources (
    id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, original_size_bytes, optimized_size_bytes
  ) VALUES (
    gen_random_uuid(), 'cse-1205', 'big_ok.pdf', 'big_ok.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/big_ok.pdf', 'Lecture Note', v_test_student_uid, 'pending', 'phase6-big-ok', 'application/pdf', 20971520, 10485760
  );

  -- 13b: Oversized stored PDF (10 MB)/original PDF (20 MB) must be rejected
  v_threw := false;
  BEGIN
    INSERT INTO public.resources (
      id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, original_size_bytes, optimized_size_bytes
    ) VALUES (
      gen_random_uuid(), 'cse-1205', 'oversize_stored.pdf', 'oversize_stored.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/oversize_stored.pdf', 'Lecture Note', v_test_student_uid, 'pending', 'phase6-oversize-stored', 'application/pdf', 1024, 10485761
    );
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: oversized stored PDF slipped past resources_size_limits_check!';

  v_threw := false;
  BEGIN
    INSERT INTO public.resources (
      id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, original_size_bytes, optimized_size_bytes
    ) VALUES (
      gen_random_uuid(), 'cse-1205', 'oversize_orig.pdf', 'oversize_orig.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/oversize_orig.pdf', 'Lecture Note', v_test_student_uid, 'pending', 'phase6-oversize-orig', 'application/pdf', 20971521, 1048576
    );
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: oversized original PDF slipped past resources_size_limits_check!';

  -- 13c: Office (15 MB) and image (10 MB) boundary enforcement
  v_threw := false;
  BEGIN
    INSERT INTO public.resources (
      id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, original_size_bytes, optimized_size_bytes
    ) VALUES (
      gen_random_uuid(), 'cse-1205', 'oversize_pptx.pptx', 'oversize_pptx.pptx', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/oversize_pptx.pptx', 'Lecture Note', v_test_student_uid, 'pending', 'phase6-oversize-pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 15728641, 15728641
    );
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: oversized PPTX slipped past resources_size_limits_check!';

  v_threw := false;
  BEGIN
    INSERT INTO public.resources (
      id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, original_size_bytes, optimized_size_bytes
    ) VALUES (
      gen_random_uuid(), 'cse-1205', 'oversize.png', 'oversize.png', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/oversize.png', 'Image Scan', v_test_student_uid, 'pending', 'phase6-oversize-img', 'image/png', 10485761, 10485761
    );
  EXCEPTION WHEN check_violation THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: oversized PNG slipped past resources_size_limits_check!';

  RAISE NOTICE '✓ Test 13 Passed: resources_size_limits_check enforces 20/10 MB PDF, 15 MB office, 10 MB image.';

  -- -------------------------------------------------------------------
  -- TEST 14: REJECTED-FILE CLEANUP QUEUE (PHASE 6) + AUTHORIZATION
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 14: Testing get_rejected_storage_cleanup_queue gating + rejection footprint...';

  -- 14a: Create a rejected resource that STILL holds its storage_path
  INSERT INTO public.resources (
    id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, rejection_reason, original_size_bytes, optimized_size_bytes
  ) VALUES (
    gen_random_uuid(), 'cse-1205', 'orphan_rejected.pdf', 'orphan_rejected.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/orphan_rejected.pdf', 'Lecture Note', v_test_student_uid, 'rejected', 'phase6-orphan-rejected', 'application/pdf', 'cleanup-pending fixture', 2048, 1024
  );

  -- 14b: Admin sees it in the cleanup queue
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_cr_uid::text, true);
  v_n := 0;
  SELECT COUNT(*) INTO v_n FROM public.get_rejected_storage_cleanup_queue();
  ASSERT v_n >= 1, 'FAILED: cleanup queue did not surface the cleanup-pending rejected file!';

  -- 14c: A student (non-moderator) is denied the queue
  PERFORM set_config('request.jwt.claim.sub', v_test_student_uid::text, true);
  v_threw := false;
  BEGIN
    PERFORM * FROM public.get_rejected_storage_cleanup_queue();
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: a student could read the moderator-only cleanup queue!';

  -- 14d: The rejected-with-path row still counts toward committed quota
  --      (reserve_storage sees the orphan, so it is not silently dropped).
  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  SELECT COALESCE(SUM(optimized_size_bytes), 0) INTO v_n
  FROM public.resources WHERE storage_path IS NOT NULL AND file_hash = 'phase6-orphan-rejected';
  ASSERT v_n = 1024, 'FAILED: rejected-but-physical file lost its quota footprint!';

  -- 14e: Idempotency signal (retry path): a cleared pointer no longer appears
  UPDATE public.resources
  SET storage_path = NULL, optimized_size_bytes = 0
  WHERE file_hash = 'phase6-orphan-rejected';
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_cr_uid::text, true);
  SELECT COUNT(*) INTO v_n FROM public.get_rejected_storage_cleanup_queue()
  WHERE original_filename = 'orphan_rejected.pdf';
  ASSERT v_n = 0, 'FAILED: cleared cleanup-pending row still surfaced in the queue!';

  RAISE NOTICE '✓ Test 14 Passed: cleanup queue is moderator-gated, idempotent, and reclaims quota only after clear.';

  -- -------------------------------------------------------------------
  -- TEST 15: QUOTA INCLUDES REJECTED-STORAGE LEFTOVERS (PHASE 6)
  -- -------------------------------------------------------------------
  RAISE NOTICE 'Test 15: Testing reserve_storage against rejected-but-stored footprint...';

  PERFORM set_config('role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);

  -- Baseline of everything currently committed (no orphan_rejected anymore:
  -- cleared at 14e). We shrink the quota ceiling to a determinable headroom so
  -- the leftover footprint becomes observable without any real data.
  SELECT COALESCE(SUM(optimized_size_bytes), 0) INTO v_committed_baseline
  FROM public.resources WHERE storage_path IS NOT NULL;
  UPDATE public.storage_quota SET max_bytes = v_committed_baseline + 1000;

  -- 15a: Insert a rejected leftover of 600 bytes (with path) on top of baseline
  INSERT INTO public.resources (
    id, course_id, original_filename, stored_filename, storage_path, resource_type, uploader_id, status, file_hash, mime_type, original_size_bytes, optimized_size_bytes
  ) VALUES (
    gen_random_uuid(), 'cse-1205', 'orphan_quota.pdf', 'orphan_quota.pdf', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/orphan_quota.pdf', 'Lecture Note', v_test_student_uid, 'rejected', 'phase6-quota-orphan', 'application/pdf', 2048, 600
  );

  -- 15b: 401+600 > 1000 headroom  => reservation must fail
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_test_student_uid::text, true);
  v_threw := false;
  BEGIN
    PERFORM public.reserve_storage(401);
  EXCEPTION WHEN others THEN
    v_threw := true;
  END;
  ASSERT v_threw = true, 'FAILED: quota reservation ignored the rejected-but-stored 600-byte footprint!';

  -- 15c: 400+600 <= 1000 headroom => reservation succeeds (boundary holds)
  v_reserved := public.reserve_storage(400);
  ASSERT v_reserved IS NOT NULL, 'FAILED: boundary reservation rejected despite sufficient headroom!';
  PERFORM public.release_storage_reservation(v_reserved);

  -- Restore quota ceiling
  UPDATE public.storage_quota SET max_bytes = 838860800;

  RAISE NOTICE '✓ Test 15 Passed: reserve_storage accounts for rejected-but-physical footprint atomically.';

  RAISE NOTICE '=====================================================';
  RAISE NOTICE 'ALL KUCSE25 DATABASE SECURITY TESTS PASSED!';
  RAISE NOTICE '=====================================================';
END $$;

ROLLBACK; -- Clean rollback of test data
