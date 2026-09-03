# Central Excel Workbook Schema (Design)

Design doc for the single shared `.xlsx` workbook that acts as the system's data store
(see `CONTEXT.md` sections 1, 2, 12). Not yet implemented — no read/write code or actual
workbook exists yet. This defines target sheet names and columns for the Excel data-access
layer to build against.

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
| role | e.g. `registration_desk` \| `observer` \| `admin` |
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

## Concurrency (resolved)

Writes from 3-6 tablets are serialized via `excel_store.transaction()` — a `FileLock` +
in-process `threading.Lock` held across an entire read-check-write sequence (not just a
single call), so check-then-act operations (duplicate registration/sign-in, sequential
certificate numbering) can't race. Verified under concurrent load with 10 simultaneous
duplicate-registration/sign-in attempts and 8 simultaneous certificate issuances — see
`app/routers/registrations.py`, `attendance.py`, `certificates.py`, `imports.py` for usage.
Multi-process/multi-worker deployment is still covered by the `FileLock` (file-based, not
just in-process), but hasn't been load-tested across real separate processes yet.

## Open questions

- Where the workbook and per-event backups live on disk / storage in production.
- ID generation strategy (UUID vs. sequential per sheet) given Excel has no autoincrement —
  currently UUID hex for all primary keys except certificate_no, which is a per-event
  sequential counter.
