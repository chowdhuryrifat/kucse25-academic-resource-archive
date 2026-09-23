# KUCSE25 Academic Resource Archive - Supabase Database & Security Architecture

This directory contains the database migrations, master schema, and security test suite for the **Khulna University CSE Batch 25 Academic Resource Archive**.

---

## 1. Migration Sequence

Migrations are timestamped and designed to be executed in sequence or applied via `supabase db push` / `supabase migration up`:

| Migration File | Description |
|---|---|
| `20260923000000_phase1_kucse25_students_auth.sql` | Initial authentication and student roster tables. |
| `20260923010000_phase2_database_security.sql` | **Phase 2 Production Schema**: `public.profiles`, `public.resources`, `public.kucse25_roster`, RLS policies, immutable triggers, status transition state machine, and private `resources` storage bucket. |
| `20260923020000_phase3_storage_quota_optimization.sql` | **Phase 3 Quota Protection & Optimization**: `public.storage_quota` (800 MB ceiling), `public.storage_reservations` (in-flight concurrency control), duplicate content hash index, atomic reservation RPCs, and storage object cleanup policies. |
| `20260923030000_phase4_storage_rls_fixes.sql` | **Phase 4 Storage RLS Fixes**: approved-only signed-URL access to `storage.objects` via the RLS-safe `resource_storage_path_is_approved` SECURITY DEFINER resolver (never a raw `resources` subquery, which is invisible to public roles), upload path hardening to the canonical `<uuid>/<sanitized-filename>` layout, and removal of any legacy unrestricted upload policy. |
| `20260923040000_phase5_public_boundary.sql` | **Phase 5 Public Boundary**: narrows the `public_resources` view to public-safe columns, removes the broad anon/authenticated SELECT policies on `resources` and `profiles`, and adds the approved-only `get_resource_read_info` RPC for on-demand signed-URL path resolution. |
| `20260923050000_phase6_final_hardening.sql` | **Phase 6 Final Hardening**: per-format size-limit CHECK constraint at the database boundary (PDF 20/10 MB, PPT/PPTX 15/15 MB, DOC/DOCX 15/15 MB, PNG/JPEG 10/10 MB, 25 MB general input ceiling), `reserve_storage` now counts every retained `storage_path` regardless of status (rejected-but-not-purged files keep their quota footprint), storage bucket tightened to a 15 MB / 7-MIME-type allowlist, and the moderator-only `get_rejected_storage_cleanup_queue()` RPC so deletion failures remain detectable and retryable. |


The consolidated production schema is also available in `supabase/schema.sql`.

---

## 2. Table Specifications & Security Design

### `public.profiles`
- **Primary Key**: `id UUID REFERENCES auth.users(id) ON DELETE CASCADE`
- **Fields**: `student_id`, `name`, `email`, `role`, `is_active`, `created_at`, `updated_at`
- **Role Constraint**: `CHECK (role IN ('student', 'cr', 'acr'))`
- **Student ID Constraint**: `CHECK (student_id ~ '^2502(0[1-9]|[1-3][0-9]|4[0-3])$' AND student_id NOT IN ('250210', '250216', '250217', '250227'))`
- **Institutional Email Constraint**: `CHECK (email ~* '^2502(0[1-9]|[1-3][0-9]|4[0-3])@ku\.ac\.bd$' AND email NOT IN ('250210@ku.ac.bd', '250216@ku.ac.bd', '250217@ku.ac.bd', '250227@ku.ac.bd'))`
- **Immutability Trigger**: `prevent_profile_tampering()` prevents authenticated students from manipulating their `student_id`, `email`, `role`, or `is_active` status.

### `public.resources`
- **Primary Key**: `id UUID DEFAULT gen_random_uuid()`
- **Foreign Key**: `uploader_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE` (Enables PostgREST relational queries `profiles:uploader_id(name)`)
- **Status Constraint**: `CHECK (status IN ('pending', 'approved', 'rejected', 'archived'))` (Default: `'pending'`)
- **Download Count**: `CHECK (download_count >= 0)` (Default: `0`)
- **Resource Types**: `CHECK (resource_type IN ('Lecture Slide', 'Lecture Note', 'Lab', 'Assignment', 'Question', 'Solution', 'Cheat Sheet', 'Other'))`
- **Submission Protection**: `force_pending_resource_on_insert()` overrides client input to force `status = 'pending'`, `download_count = 0`, and `uploader_id = auth.uid()`.
- **State Transition Machine**: `enforce_resource_status_transition()` strictly enforces:
  - `pending` ➔ `approved` or `rejected`
  - `approved` ➔ `archived`
  - `rejected` ➔ `archived`
  - Only users where `public.is_admin() = true` can change status.
  - Automatically records `reviewed_at` and `reviewed_by`.

### `public.public_resources` View
- Public privacy boundary view.
- Joins `public.resources` and `public.profiles` for `status = 'approved'`.
- Exposes: `id`, `course_id`, `original_filename`, `resource_type`, `uploader_name`, `download_count`, `original_size_bytes`, `created_at`.
- **Zero Exposure**: Completely hides uploader email, student ID, internal `storage_path`, `file_hash`, `mime_type`, `rejection_reason`, and reviewer audit fields. Anonymous/authenticated users no longer have a broad SELECT policy on `resources` or `profiles` (Phase 5); public reads flow only through this view, and storage path resolution for signed URLs goes only through the approved-only `get_resource_read_info` RPC.

---

## 3. Storage Architecture (`resources` Bucket)

- **Bucket**: `resources` (Private, non-public: `public = false`)
- **Object Path Scheme**: `resources/{resource-id}/{sanitized-file-name}`
- **Storage RLS**:
  - Authenticated active students: Can upload files (`INSERT`).
  - CR/ACR: Can view (`SELECT`) and delete (`DELETE`) all files for moderation.
  - Students: Can read (`SELECT`) their own uploaded files or approved resource files.
  - Public: Access files only through temporary signed URLs generated by the application for approved resources.

---

## 4. Atomic Download Counter RPC (`increment_download`)

```sql
SELECT public.increment_download('8740c4a0-520e-436f-b25c-097475f73d83'::uuid);
```
- Operates atomically in a single statement.
- Validates that the target resource exists and has `status = 'approved'`.
- Returns the updated `download_count`.
- Rejects unapproved, pending, or archived resources.

---

## 5. Running the Test Suite

Run the test suite against your Supabase project via SQL Editor or CLI:

```bash
# Using Supabase CLI
supabase db reset
psql -f supabase/tests/rls_and_security_tests.sql

# Or paste contents of supabase/tests/rls_and_security_tests.sql directly into Supabase Dashboard SQL Editor
```

The test script automatically tests:
1. Student whitelist & excluded rolls enforcement (10, 16, 17, 27).
2. Profiles role constraint (`student`, `cr`, `acr`).
3. `is_admin()` and `is_active_student()` resolution.
4. Automatic forcing of `status = 'pending'` and `download_count = 0` on insert.
5. Strict state machine transitions for moderation.
6. Atomic `increment_download` RPC behavior.
7. Public privacy view isolation.

---

## 6. Storage Quota Protection & Optimization Architecture

1. **800 MB Application Ceiling**:
   - Stored in `public.storage_quota` (default `838,860,800` bytes).
   - Authoritative usage is calculated from `optimized_size_bytes` on resources physically in storage.
2. **Atomic Quota Reservation (`reserve_storage`)**:
   - Enforces concurrency serialization via row-level locks on `public.storage_quota`.
   - Prunes expired reservations (> 10 minutes).
   - Rejects uploads if `committed_bytes + in_flight_reservations + required_bytes > 800 MB`.
3. **Duplicate Content Fingerprinting (`check_duplicate_hash`)**:
   - Uses partial unique index on `resources(file_hash) WHERE status IN ('pending', 'approved')`.
   - Prevents identical files from being uploaded or duplicated.
4. **Storage Cleanup Policies**:
   - If a database insert fails after an upload, the client immediately removes the uploaded storage object.
   - When a CR or ACR rejects a submission, the physical storage object is deleted from the `resources` bucket and `storage_path` / `optimized_size_bytes` are cleared, reclaiming quota immediately while retaining review audit history for the student.

