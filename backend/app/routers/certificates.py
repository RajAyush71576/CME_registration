from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models
from app.auth import require_admin
from app.certificate_pdf import CERTIFICATES_DIR, render_certificate_pdf
from app.database import get_db
from app.db_utils import row_to_dict
from app.schemas import Certificate, CertificateIssue

router = APIRouter(
    prefix="/certificates",
    tags=["certificates"],
    dependencies=[Depends(require_admin)],
)


@router.post("/issue", response_model=Certificate, status_code=201)
def issue_certificate(payload: CertificateIssue, db: Session = Depends(get_db)):
    registration = (
        db.query(models.Registration)
        .filter_by(registration_id=payload.registration_id)
        .first()
    )
    if registration is None:
        raise HTTPException(status_code=404, detail="Registration not found")

    participant = (
        db.query(models.Participant).filter_by(participant_id=registration.participant_id).first()
    )
    event = db.query(models.Event).filter_by(event_id=registration.event_id).first()

    attendance = (
        db.query(models.Attendance)
        .filter_by(registration_id=payload.registration_id)
        .first()
    )
    if attendance is None or not attendance.sign_out_time:
        raise HTTPException(
            status_code=400,
            detail="Not eligible: attendance sign-in/sign-out not completed",
        )

    if event.cme_credits and not participant.medical_license_no:
        raise HTTPException(
            status_code=400,
            detail="Medical license number is required for CME-credit events",
        )

    # Atomic per-event sequential numbering: a plain UPDATE takes a row lock,
    # so two concurrent issuances for the same event serialize on this
    # statement — no separate lock needed (see CONTEXT.md concurrency notes).
    last_no = db.execute(
        update(models.EventCertificateCounter)
        .where(models.EventCertificateCounter.event_id == event.event_id)
        .values(last_no=models.EventCertificateCounter.last_no + 1)
        .returning(models.EventCertificateCounter.last_no)
    ).scalar_one()
    certificate_no = f"{last_no:03d}"

    certificate = models.Certificate(
        certificate_no=certificate_no,
        event_id=event.event_id,
        participant_id=participant.participant_id,
        delivery_status="pending",
    )
    db.add(certificate)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Certificate already issued for this participant/event",
        )
    db.refresh(certificate)

    render_certificate_pdf(
        certificate.certificate_id, certificate_no, row_to_dict(event), row_to_dict(participant)
    )
    return row_to_dict(certificate)


@router.get("", response_model=list[Certificate])
def list_certificates(db: Session = Depends(get_db)):
    return [row_to_dict(c) for c in db.query(models.Certificate).all()]


@router.get("/{certificate_id}", response_model=Certificate)
def get_certificate(certificate_id: str, db: Session = Depends(get_db)):
    certificate = db.query(models.Certificate).filter_by(certificate_id=certificate_id).first()
    if certificate is None:
        raise HTTPException(status_code=404, detail="Certificate not found")
    return row_to_dict(certificate)


@router.get("/{certificate_id}/pdf")
def download_certificate(certificate_id: str, db: Session = Depends(get_db)):
    certificate = db.query(models.Certificate).filter_by(certificate_id=certificate_id).first()
    if certificate is None:
        raise HTTPException(status_code=404, detail="Certificate not found")
    path = CERTIFICATES_DIR / f"{certificate_id}.pdf"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Certificate PDF not found")
    return FileResponse(
        path,
        media_type="application/pdf",
        filename=f"certificate_{certificate.certificate_no}.pdf",
    )
