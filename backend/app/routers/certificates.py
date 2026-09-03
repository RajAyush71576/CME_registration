from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

from app import excel_store as store
from app.auth import get_current_user
from app.certificate_pdf import CERTIFICATES_DIR, render_certificate_pdf
from app.schemas import Certificate, CertificateIssue

router = APIRouter(
    prefix="/certificates",
    tags=["certificates"],
    dependencies=[Depends(get_current_user)],
)


@router.post("/issue", response_model=Certificate, status_code=201)
def issue_certificate(payload: CertificateIssue):
    with store.transaction() as tx:
        registration = tx.find_row(
            "Registrations", "registration_id", payload.registration_id
        )
        if registration is None:
            raise HTTPException(status_code=404, detail="Registration not found")

        participant = tx.find_row(
            "Participants", "participant_id", registration["participant_id"]
        )
        event = tx.find_row("Events", "event_id", registration["event_id"])

        attendance = tx.find_row(
            "Attendance", "registration_id", payload.registration_id
        )
        if attendance is None or not attendance.get("sign_out_time"):
            raise HTTPException(
                status_code=400,
                detail="Not eligible: attendance sign-in/sign-out not completed",
            )

        if event["cme_credits"] and not participant.get("medical_license_no"):
            raise HTTPException(
                status_code=400,
                detail="Medical license number is required for CME-credit events",
            )

        existing_certs = tx.list_rows("Certificates")
        duplicate = [
            c
            for c in existing_certs
            if c["event_id"] == event["event_id"]
            and c["participant_id"] == participant["participant_id"]
        ]
        if duplicate:
            raise HTTPException(
                status_code=409,
                detail="Certificate already issued for this participant/event",
            )

        event_certs = [c for c in existing_certs if c["event_id"] == event["event_id"]]
        certificate_no = f"{len(event_certs) + 1:03d}"

        certificate_id = store.new_id()
        row = {
            "certificate_id": certificate_id,
            "certificate_no": certificate_no,
            "event_id": event["event_id"],
            "participant_id": participant["participant_id"],
            "delivery_status": "pending",
            "issued_at": store.now_iso(),
        }
        tx.append_row("Certificates", row)
        render_certificate_pdf(certificate_id, certificate_no, event, participant)
        return row


@router.get("", response_model=list[Certificate])
def list_certificates():
    return store.list_rows("Certificates")


@router.get("/{certificate_id}", response_model=Certificate)
def get_certificate(certificate_id: str):
    row = store.find_row("Certificates", "certificate_id", certificate_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return row


@router.get("/{certificate_id}/pdf")
def download_certificate(certificate_id: str):
    row = store.find_row("Certificates", "certificate_id", certificate_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Certificate not found")
    path = CERTIFICATES_DIR / f"{certificate_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Certificate PDF not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"certificate_{row['certificate_no']}.pdf",
    )
