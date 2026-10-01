# Central Excel Workbook Schema (Historical)

**Superseded (2026-09-07)**: Postgres is now the live data store — see `CONTEXT.md` Status →
"PostgreSQL + Redis migration" and `backend/app/models.py`. Excel is import/export-only
(uploading a registrant sheet, downloading a report/observer-sheet). This document is kept
because the Postgres schema is a near-1:1 mirror of what's described below (same field names,
same shapes) — read it as "what each table represents," not as a description of a live
workbook anymore.

## Sheet: `Participants`

| Column | Notes |
|---|---|
| participant_id | Primary key, generated |
| name | Required |
| designation | Job role / specialty, required |
| email | Required/recommended |
| phone | Required |
| whatsapp_number | Required |
| place_of_work | Required |
| country | Required for international attendees |
| medical_license_no | Optional; required when the linked event has CME credits enabled |
| participant_type | `Faculty` \| `Delegate` |
| source | `website` \| `import` \| `on_spot` |
| created_at | Timestamp |

## Sheet: `Events`

| Column | Notes |
|---|---|
| event_id | Primary key, generated |
| event_name | Required |
| event_date | Required |
| venue | Required |
| organizing_doctors | Up to 3, stored delimited (e.g. `;`-separated) |
| department | Required |
| cme_credits | Boolean flag |
| approx_duration_hours | Required; gates sign-out/sign-off + certificate eligibility |

## Sheet: `Registrations`

| Column | Notes |
|---|---|
| registration_id | Primary key, generated |
| participant_id | FK → Participants |
| event_id | FK → Events |
| source | `website` \| `import` \| `on_spot` |
| registered_at | Timestamp |

## Sheet: `Attendance`

| Column | Notes |
|---|---|
| attendance_id | Primary key, generated |
| registration_id | FK → Registrations |
| status | e.g. `PRESENT` |
| sign_in_time | Timestamp, auto-captured |
| sign_in_signature_ref | Pointer to stored signature file |
| sign_out_time | Timestamp, auto-captured; only settable once duration check passes |
| sign_out_signature_ref | Pointer to stored signature file |
| device_id | e.g. `TAB-REG-037` |

## Sheet: `Certificates`

| Column | Notes |
|---|---|
| certificate_id | Primary key, generated |
| certificate_no | Sequential (001, 002, ...) |
| event_id | FK → Events |
| participant_id | FK → Participants |
| delivery_status | e.g. `pending` \| `sent_email` \| `sent_whatsapp` \| `failed` |
| issued_at | Timestamp |

## Sheet: `ImportBatches`

| Column | Notes |
|---|---|
| batch_id | Primary key, generated |
| source_file | Original filename |
| source_type | `cme_website` \| `external_society` |
| imported_at | Timestamp |
| imported_by | User/staff reference |
| row_count | Total rows processed |
| error_count | Rows that failed validation |

## Sheet: `ImportErrors`

| Column | Notes |
|---|---|
| batch_id | FK → ImportBatches |
| row_number | Row in source file |
| error_message | Validation failure reason |

## Sheet: `Users`

| Column | Notes |
|---|---|
| user_id | Primary key, generated |
| name | Staff name |
| role | `admin` \| `staff` — enforced server-side via `require_admin` (see CONTEXT.md Status) |
| email | Login identifier |
| password_hash | bcrypt hash; never store/return plaintext |

## Sheet: `AuditLogs`

| Column | Notes |
|---|---|
| log_id | Primary key, generated |
| user_id | FK → Users |
| action | e.g. `import`, `attendance_correction`, `certificate_reissue` |
| target_ref | ID of the affected record |
| timestamp | Auto-captured |
| details | Free text |

## Concurrency (resolved, now via Postgres)

Originally serialized via `excel_store.transaction()` (a `FileLock` + in-process
`threading.Lock`); as of the Postgres migration this is real database transactions and
constraints instead — `UNIQUE(participant_id, event_id)` / `UNIQUE(registration_id)` reject
duplicates at the database level, and certificate numbering uses an atomic `UPDATE ...
RETURNING` on a per-event counter row. Re-verified under the same concurrent-load test
(10 simultaneous duplicate-registration/sign-in attempts, 8 simultaneous certificate
issuances) against real Postgres — see `app/routers/registrations.py`, `attendance.py`,
`certificates.py`, `imports.py`. This approach is correct across multiple backend processes
natively (no file lock needed at all).

## Open questions

- Backup/retention strategy for the Postgres data in production (not yet defined).
- ID generation strategy — currently UUID hex for all primary keys except certificate_no,
  which is a per-event sequential counter (`event_certificate_counters` table).
