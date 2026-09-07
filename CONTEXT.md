# CME Registration, Tablet Attendance & E-Certificate System

Context file distilled from `CME_Registration_Attendance_System_Meeting_Requirements_Updated.docx`.
This captures the agreed functional requirements and target architecture so future work in this
repo starts from a shared understanding. See **Status** at the bottom for what's actually built
and what to do next — that section is kept up to date as work progresses; the requirements above
are the stable source of truth and shouldn't need to change as implementation proceeds.

## Scope

Registration, Excel import, multi-tablet sign-in/sign-out, attendance, certificates, observer
sign-off, and email/WhatsApp communication. Data is managed centrally via **Excel** (not a
database). Chatbot and multi-conference scaling are explicitly deferred.

## 1. Registration Data Fields

| Field | Requirement |
|---|---|
| Name | Required |
| Designation / Job Role / Specialty | Required |
| Email | Required/recommended |
| Phone | Required |
| WhatsApp Number | Required |
| Place of Work | Required |
| Country | For international attendees |
| Medical License No. | Optional by default; mandatory when CME credits apply |
| Participant Type | Faculty or Delegate |

## 2. Event Data

| Attribute | Requirement |
|---|---|
| Event Name | Required |
| Event Date | Required |
| Venue | Required |
| Organizing Doctors | Up to 3 |
| Department | Required |
| CME Credits | Yes/No flag |
| Approximate Duration (Hours) | Required. Gates sign-out/sign-off and certificate eligibility. |

## 3. Registration & On-Spot Workflow

Pre-registered participants are loaded from the CME website Excel export. On-spot participants
enter their own details on the tablet. Imported participants can be searched at sign-in and may
edit permitted information before signing. If CME credits apply, the medical license number must
be completed before certificate eligibility.

```
CME Website Excel / On-Spot Tablet → Validation → Central Excel Data Store
  → Staff Search → Auto-Fill → Review/Edit → Signature
```

## 4. Excel Import

Primary source is the Excel export from the CME website (all registrants for the event). External
society registration lists are reformatted to the standard import template before upload.

| Import | System Behaviour |
|---|---|
| CME website Excel | Primary source |
| External society list | Reformat to standard template |
| Validation | Required fields, event mapping, duplicate checks |
| Errors | Row-level errors + import summary |
| Source | Track website/import/on-spot origin |

## 5. Multi-Tablet Deployment

Centrally hosted, accessed by ~3-6 tablets depending on event size. All tablets connect to the
same backend/API, which reads/writes a shared central Excel data store — attendance recorded on
one tablet is immediately reflected everywhere.

```
3-6 Tablets → Central Backend/API → Central Excel Data Store
  → Signature Storage → Certificates → Email / WhatsApp
```

## 6. Event-Day Attendance

Two actions: **sign-in** (arrival) and **sign-out** (end of event), both auto-timestamped. In both
cases the participant's signature is captured on the tablet (stylus/touchscreen) at the point of
signing. Sign-out (observer sign-off) is only enabled once recorded attendance duration is
consistent with the event's approximate duration; otherwise sign-off stays disabled for that
registrant. These records feed certificate eligibility.

```
ARRIVAL: Search → Validate → Auto-Fill → Review/Edit → Signature (Stylus) → SIGN-IN TIME
END:     Identify Participant → Duration Check (vs approx. hours) → Signature (Stylus)
           → SIGN-OUT TIME → Eligibility Check
```

Example record:

| Field | Value |
|---|---|
| Participant | Dr. Rahul Sharma |
| Status | PRESENT |
| Sign-in | 09:42 AM |
| Sign-out | 04:35 PM |
| Signature | Captured on tablet (secure reference) |
| Device | TAB-REG-037 |

## 7. Search & Auto-Fill

Staff can search the central Excel data store by registration ID, mobile number, email, or name.
The selected record auto-populates on the tablet. Imported records and online registrations follow
the same check-in process.

```
Registration ID / Mobile / Email / Name → Participant → Event Validation
  → Auto-Fill → Allowed Edits → Signature on Tablet
```

## 8. E-Certificate Workflow

Certificates auto-populate from validated participant data (name, license number where
applicable), get sequential numbers (001, 002, 003, ...), reuse an approved template
(event-specific name/logo fields change per event), and are sent by email or WhatsApp after the
event.

```
Attendance Validation → Eligibility (incl. Duration Check) → Sequential Certificate No.
  → Populate Name/License → Approved Template → Email / WhatsApp
```

## 9. CME Observer Sign-Off

At event end, generate and print a colored attendance sheet for the CME observer, sent to the
observer's office. Goal is one consolidated batch sign-off rather than individual signatures.
Available only for registrants whose attendance duration meets the event's approximate duration
requirement.

```
Event End → Colored Attendance Sheet → Print → Observer's Office → Batch Sign-Off
```

## 10. WhatsApp & Email

| Channel | Purpose |
|---|---|
| WhatsApp Business — "Amrita CME" | Registration confirmation, reminders, certificate delivery |
| Messaging model | One-to-one outbound messages; no group workflow |
| Email | Retained alongside WhatsApp for records/preferences |
| Chatbot | Future FAQ/policy layer; deferred until core flow is stable |

## 11. Architecture

```
Participant/Staff UI (React + Vite)
  — Online Registration, Excel Import, Tablet Check-in [3-6 tablets]
  → Central Backend/API (FastAPI)
    → Central Excel Data Store | Signature Storage | Certificate Service
      → Email / WhatsApp
```

## 12. Main Data Entities (Excel Workbook Structure)

| Entity (Sheet) | Purpose |
|---|---|
| Participants | Identity, contact, professional data |
| Events | Name, date, venue, department, organizers, CME flag, approx. duration (hours) |
| Registrations | Participant/event link and source |
| Attendance | Sign-in/out, status, signature, device |
| Certificates | Certificate number, event, participant, delivery status |
| Import Batches/Errors | Excel upload tracking and validation |
| Users/Audit Logs | Staff roles and traceability |

## 13. Recommended Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React + Vite |
| UI | CSS / Tailwind CSS |
| Signature | HTML Canvas / Signature Pad |
| Backend | Python + FastAPI |
| Data Storage | Excel (.xlsx) via a shared central workbook |
| Excel Processing | openpyxl / pandas |
| File/Media Storage | Cloudinary or S3-compatible storage (signatures, certificates) |
| Security | JWT + Role-Based Access Control |
| Deployment | Docker + Nginx + HTTPS |
| Communication | WhatsApp Business + Email provider |

## 14. Attendance & Reporting Export

Authorized staff can export a consolidated attendance report from the central Excel data store:
participant identity, event, sign-in/sign-out timestamps, attendance status, verification method,
device ID. Export is for reporting/offline sharing only — the central Excel workbook remains the
live source of truth.

## 15. Key Business Rules

- WhatsApp number is mandatory for all registrants.
- License number mandatory when CME credits are enabled.
- Faculty/Delegate status must be stored.
- Up to 3 organizing doctors per event.
- Venue is mandatory for every event.
- Approximate event duration (hours) determines whether sign-off (sign-out) is enabled for a
  registrant.
- Imported participant details can be edited at sign-in where permitted.
- Sign-in and sign-out signatures are captured on the tablet and timestamped automatically.
- Duplicate attendance is prevented by backend/data validation.
- Sequential certificate numbering is maintained.
- Email remains available alongside WhatsApp.

## 16. Security & Data Integrity

HTTPS, role-based staff access, secure staff authentication for search, server-side validation,
duplicate constraints/transactions, protected signature storage, import audit logs, attendance
correction logs.

## 17. Development Priority

```
Requirements approval → Registration/Event model → Excel import → Tablet search/auto-fill
  → Sign-in/out → Multi-tablet testing → Attendance/reporting → Certificates
  → Email/WhatsApp → Observer sheet → Production deployment
```

Chatbot and conference scaling remain deferred until the core flow is stable.

## 18. Final End-to-End Flow

```
CME Website Excel / On-Spot Registration
  → Validation + Central Excel Data Store
  → 3-6 Tablets: Staff Search → Auto-Filled Details + Allowed Edits
  → Arrival Signature on Tablet + Timestamp
  → Duration Check + End Signature on Tablet + Timestamp
  → Attendance & Certificate Eligibility
  → Colored Observer Attendance Sheet
  → Sequential E-Certificate
  → Email / WhatsApp Delivery
```

## Status

_Last updated: 2026-09-07._ Requirements were never formally approved in writing (per the source
doc's own "Next step"), but implementation proceeded iteratively anyway. The core flow described
in §18 (Final End-to-End Flow) is implemented end-to-end and manually verified except email/WhatsApp
delivery.

**Repo layout**: `backend/` (FastAPI + openpyxl, Python venv), `frontend/` (React + Vite +
Tailwind + React Router), `docs/excel-schema.md` (workbook schema + concurrency design),
`CONTEXT.md` (this file).

**Built and verified**:
- Excel data-access layer (`backend/app/excel_store.py`) with all 9 sheets, and a
  `transaction()` primitive that holds the file+process lock across an entire
  check-then-act sequence (fixes a real race found under load-testing — see Multi-tablet
  concurrency below).
- Events, Participants, Registrations CRUD (§1, §2) with business-rule validation (§15):
  max 3 organizing doctors, venue/WhatsApp mandatory, license required when a registration
  is for a CME-credit event, duplicate-registration rejection.
- Excel Import (§4): `POST /import/participants` (multipart upload), template download,
  row-level validation errors, import batch history, participant de-dup by email across
  events.
- Tablet search & auto-fill (§7): `GET /registrations/search` by reg ID/mobile/email/name.
- Attendance sign-in/sign-out (§6) with signature capture (canvas pad → PNG on disk) and
  duration-gated sign-out (blocked until elapsed time ≥ event's `approx_duration_hours`).
- E-Certificates (§8): eligibility-gated issuance, per-event sequential numbering, PDF
  generation (placeholder template — no real logo/design supplied yet).
- CME Observer Sign-Off Sheet (§9): colored PDF listing only registrants who completed
  sign-out, for one batch sign-off.
- Attendance & Reporting Export (§14): consolidated `.xlsx` export, optionally event-scoped.
- Auth (§16): real JWT auth, bcrypt password hashes, all endpoints except `/health` and
  `/auth/login` require a valid token. 2 seed accounts (`admin@cme.local`/`admin123`,
  `staff@cme.local`/`staff123`) — no staff account-management UI yet.
- **Two-role RBAC (2026-09-07)**: collapsed the old 3-role model (`admin`/`registration_desk`/
  `observer`) to exactly `admin`/`staff` per a client spec requesting a two-role architecture.
  `require_admin` dependency added in `app/auth.py`; gated admin-only at the router level:
  event creation, `imports.py`, `certificates.py`, `reports.py`, `observer_sheet.py`. Left open
  to both roles: participant/registration CRUD, search, attendance sign-in/sign-out, `GET
  /events`. Frontend split into `/admin/*` and `/staff/*` routes (`RequireRole.jsx`), role-aware
  nav (`Layout.jsx`), post-login redirect by role. **Conflict found & resolved**: certificate
  issuance was previously reachable from the staff Check-In screen
  (`AttendanceCard.jsx`) — since the spec makes certificates admin-only, that UI is now hidden
  for non-admin users (would otherwise 403). Verified live: unauthenticated → 401 everywhere;
  staff → 403 on event-create/import/certificates/reports/observer-sheet, 200/201 on
  participants/registrations/attendance; admin → 200/201 everywhere. Old `desk@cme.local`/
  `observer@cme.local` accounts no longer exist.
- Multi-tablet concurrency: load-tested with simulated concurrent tablets (duplicate
  registration, duplicate sign-in, concurrent certificate issuance) — see
  `docs/excel-schema.md` → Concurrency (resolved).
- Frontend: login page, Events/Participants/Import/Check-In/Reports pages, all wired to the
  backend and covering the above.

**Explicitly not built / open**:
- Email/WhatsApp delivery (§10) — blocked on picking a real provider (e.g. Twilio, Meta
  Cloud API, or Gupshup for WhatsApp; SendGrid/SES/etc. for email) and getting credentials.
  Nothing here can be built for real without that decision.
- Production deployment (§13, §16 latter half) — no Dockerfiles, no Nginx config, no HTTPS,
  and `JWT_SECRET` still falls back to a hardcoded dev value if the env var isn't set. Not
  safe to deploy as-is.
- Staff account management UI — accounts only exist via the hardcoded seed script
  (`backend/app/seed.py`).
- Country-required-for-international-attendees isn't enforced (§1) — `country` is just an
  optional field; nothing detects "this is an international attendee."
- Audit/correction logs (§16: "import audit logs and attendance correction logs") — import
  batches/errors are tracked, but there's no logging of *who* corrected an attendance record
  or *why*, and no `AuditLogs` writes happen anywhere yet despite the sheet existing.
- Chatbot and conference-scale — still explicitly deferred, per the source doc.
- No automated test suite — everything so far has been verified via manual curl/script
  smoke tests during development, not committed regression tests.
- The frontend has not been visually verified in a real browser in this environment
  (Claude-in-Chrome extension wasn't connected) — only build/route/API-level checks were
  done. Worth an actual click-through before treating any page as done.
- **RBAC upgrade Phases 2-4** (Phase 1 — role gating — is done, see above):
  - Phase 2: no `PUT /participants/{id}` edit endpoint exists at all yet — staff can create
    and search participants but not correct a detail on the spot. Decided approach:
    lightweight `updated_by`/`updated_at` stamps (not a full field-diff audit log).
  - Phase 3: Events sheet is still missing `event_code`, `status` (active/inactive),
    `created_by`, `created_at`/`updated_at`. Decided: staff-facing event list should filter
    to `status == active`; sign-off gating stays duration-since-sign-in (not switched to a
    configurable wall-clock window).
  - Phase 4: no admin dashboard/stats endpoint or page yet.

**PostgreSQL + Redis migration (2026-09-07)**: per a client spec requiring a real persistent
database (Excel is input/output-only from here — imports/reports — never the live store) plus
Redis for narrowly-scoped infra needs. Full plan, decisions, and the honest "where Redis
doesn't help" reasoning are in the architecture-review conversation; only the outcomes are
tracked here.

**All four phases done and verified** — `excel_store.py` is deleted; Postgres is the live
source of truth; Excel is import/export-only, exactly as required.

- **Phase A**: `backend/app/models.py` — SQLAlchemy models for all 9 former sheets, a
  faithful mirror (same column names as the Pydantic schemas, same UUID-hex ID scheme via
  `uuid.uuid4().hex` — not Postgres's native UUID type, so the API contract barely moved)
  **plus real constraints the Excel version couldn't have**: `UNIQUE(participant_id,
  event_id)` on registrations, `UNIQUE(registration_id)` on attendance, FKs everywhere, and
  a new `event_certificate_counters` table for atomic per-event sequential certificate
  numbering (`UPDATE ... RETURNING` — a plain UPDATE takes a row lock, so concurrent
  issuances for the same event serialize on it, no app-level lock needed). `backend/app/
  database.py` (engine/session), `backend/alembic/` (migrations), `docker-compose.yml` at
  the repo root (Postgres 16 + Redis 7, local dev only — app containerization is still the
  separate "production deployment" item below), `backend/.env.example`.
- **Phase B**: every router cut over from `excel_store` to the ORM (`db_utils.row_to_dict`
  keeps the dict-style access patterns in each router's business logic unchanged, so the
  diff is almost entirely in the persistence calls, not the logic). Timestamp fields in
  `schemas.py` changed from `str` to `datetime`/`date` (Postgres returns real datetime
  objects, not ISO strings — this was the one real bug hit during cutover, caught by a
  `ResponseValidationError` on the first participant-create call and fixed immediately).
  `imports.py`'s whole-batch import takes a row lock on the target Event
  (`.with_for_update()`) for the duration of the transaction, replacing the old
  whole-workbook file lock with something correctly scoped to just that event.
- **Phase C**: Redis wired into exactly two things, per the "don't blindly add Redis"
  scoping decided earlier — rate-limiting `POST /auth/login` (10 attempts / 5 min per IP,
  429 past that) and JWT revocation on logout (`POST /auth/logout`, new endpoint; tokens
  carry a `jti` now; a revoked token's `jti` is stored in Redis with TTL = its remaining
  lifetime, checked in `get_current_user`). Frontend's `logout()` now calls the endpoint
  instead of only clearing local state. No caching, no distributed locks, no job queue —
  deliberately, per the earlier reasoning (Postgres handles concurrency correctly on its
  own at this scale; a cache would fight the real-time admin/staff consistency requirement).
- **Phase D**: `README.md` rewritten with the `docker compose up -d postgres redis` →
  `alembic upgrade head` → `uvicorn` sequence.

**Verified end-to-end** against the real containers (not mocked): full workflow (event →
participant → registration with license/CME-credit validation → sign-in → duration-gated
sign-out → certificate issuance with correct sequential numbering → PDF download), Excel
import with row-level validation errors, attendance report export, observer sheet PDF, every
RBAC boundary from the earlier phase (401/403 in all the same places), and — the actual point
of the migration — the concurrency test script re-run against Postgres: 10 concurrent
duplicate registrations → 1 success/9 conflicts, 10 concurrent duplicate sign-ins → 1/9, 8
concurrent certificate issuances → clean `001`-`008` with zero duplicates, all via real DB
transactions/constraints instead of the old custom file-lock.

**Known follow-ups, not blocking**: `event_certificate_counters` rows are only created
alongside new events going forward (fine — greenfield, no old events to backfill).
Certificate/signature files still live on local disk with the path stored in Postgres, not
S3/Cloudinary — unchanged from before, still a separate future item. Rate-limit/revocation
Redis keys aren't namespaced beyond a plain prefix — fine for one app on one Redis instance,
would want a proper key prefix if this Redis is ever shared.

**Frontend redesign + event lifecycle (2026-09-07, later same day)**: iterative UI work on top
of the migration, driven directly by the client:

- Admin Events: list sorted by date, click-through to an event detail page (event info +
  full participant table), "+ Create Event" moved into a popup modal
  (`CreateEventModal.jsx`). New backend endpoint `GET /registrations/by-event/{event_id}`
  (shared with `/search`'s join logic via `_registration_details_for_event`).
  Participants page similarly redesigned: search box + "+ Create Participant" modal.
- Staff got its own `/staff/events` + `/staff/events/:eventId` routes (same components,
  role-aware: no create-event button, back-links point at `/staff/events`). Standalone
  "Participants" nav item removed for staff — participant info is reached by drilling into
  an event instead; the `/participants` route/page still exists, just unlinked from staff
  nav.
- Event detail page: staff (not admin) can add "+ New Participant" *for that event* directly
  — `CreateParticipantModal` takes an optional `eventId` and, on success, also calls
  `POST /registrations` to register the new participant to that event in one step. If
  registration fails (e.g. missing license for a CME-credit event) the participant still
  exists but the modal reports the failure clearly rather than silently losing it.
- **Event lifecycle**: `Events.status` (`active` default / `closed`) added — new column +
  Alembic migration. `POST /events/{id}/close` (admin-only, idempotency-guarded — 400 if
  already closed). Closing an event blocks further `POST /attendance/sign-in` and
  `/sign-out` for its registrations (`"This event is closed"`, 400) and hides staff's
  "+ New Participant" button once closed. Anyone never signed in on a closed event now
  reads as **Absent** (not "Not signed in") — both in the event detail table and in the
  `/reports/attendance` export (`ABSENT` status alongside the existing `NOT SIGNED IN` /
  `SIGNED IN` / `PRESENT`). Verified live: 403 for staff attempting to close, 400 on
  double-close, sign-in correctly rejected post-close, and both the detail-page data and the
  exported report agree on who's Absent.

**Responsive/visual design pass (2026-09-07, same day)**: no backend changes. Established
consistent patterns reused across every page: `rounded-xl border border-gray-200 bg-white
shadow-sm` cards, a shared `Badge.jsx` (status/tone chips), consistent input/button/label
classes, loading states on every list page. `Layout.jsx` header now wraps instead of
overflowing on narrow widths and the content area widened to `max-w-6xl` for table-heavy
pages. Forms switched from a fixed 2-column grid to `grid-cols-1 sm:grid-cols-2` so they
stack on phones. `SignaturePad.jsx` was the one real functional fix, not just styling — it
had a **fixed 360×140 canvas**, so on any container narrower than that it would have
overflowed or (if CSS-scaled) drawn blurry/mis-mapped strokes; it now sizes itself to its
container's actual width on mount (with `devicePixelRatio` scaling for crisp lines), which
matters because `CheckInPage` is explicitly the tablet-facing screen per CONTEXT.md §31.
Also bumped touch-target sizes on `CheckInPage`/`AttendanceCard` (larger inputs/buttons,
`py-2.5`-`py-3`) for the same tablet-use reason. Verified: production build clean, every
route still serves 200, and a live login + `GET /events` round-trip against the running
backend still works — but **not visually verified in an actual browser** (Claude-in-Chrome
still not connected in this environment); worth a real click-through, especially the
signature pad on an actual tablet-sized viewport, before calling this done.

**Suggested next step**: RBAC Phase 2 (participant edit endpoint + audit stamps) is still the
next unaddressed backend gap. Email/WhatsApp remains blocked on a provider decision; full
production deployment (Nginx/HTTPS, containerizing the app itself) remains open.
