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

_Last updated: 2026-09-03._ Requirements were never formally approved in writing (per the source
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
- Auth (§16, partial): real JWT auth, bcrypt password hashes, all endpoints except
  `/health` and `/auth/login` require a valid token. 3 seed accounts only (no staff
  account-management UI yet); role is stored and shown but **not** used for access control
  (every authenticated user can do everything).
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
- Role-based access control — roles exist (`admin`, `registration_desk`, `observer`) but
  don't restrict anything yet; §16 calls for actual RBAC.
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

**Suggested next step**: pick one of Email/WhatsApp (needs your provider decision first),
production deployment hardening, or RBAC — none of the three block each other. Production
deployment is the least likely to need further decisions from you and is worth doing before
this goes anywhere near real staff/tablets.
