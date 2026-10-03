import os
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..live import notify
from ..db import CERTIFICATES_DIR, get_db, row_to_dict
from ..models import Attendance, Certificate, Event, EventCertificateCounter, Participant, Registration
from ..schemas import CertificateIssue
from ..security import require_admin

router = APIRouter(prefix="/certificates", tags=["certificates"], dependencies=[Depends(require_admin)])

BRAND = HexColor("#8e1ea2")
BRAND_LIGHT = HexColor("#f7abd9")
INK = HexColor("#1f2937")
MUTED = HexColor("#6b7280")

FONT_DIR = Path(os.getenv("WINDIR", "C:/Windows")) / "Fonts"


def _font(name: str, path, fallback: str) -> str:
    """Embed a TrueType font when available (covers accented / Latin-extended names); else a PDF base font.
    CERT_FONT / CERT_FONT_BOLD override the TTF paths, e.g. a Noto font on Linux."""
    try:
        if path and Path(path).is_file():
            pdfmetrics.registerFont(TTFont(name, str(path)))
            return name
    except Exception:
        pass
    return fallback


SERIF = _font("CertSerif", os.getenv("CERT_FONT") or FONT_DIR / "times.ttf", "Times-Roman")
SERIF_BOLD = _font("CertSerifBold", os.getenv("CERT_FONT_BOLD") or FONT_DIR / "timesbd.ttf", "Times-Bold")
SERIF_ITALIC = _font("CertSerifItalic", os.getenv("CERT_FONT") or FONT_DIR / "timesi.ttf", "Times-Italic")
SANS = _font("CertSans", os.getenv("CERT_FONT") or FONT_DIR / "arial.ttf", "Helvetica")
SANS_BOLD = _font("CertSansBold", os.getenv("CERT_FONT_BOLD") or FONT_DIR / "arialbd.ttf", "Helvetica-Bold")


def draw_fitted(c, x, y, text, font, size, max_width, min_size=10):
    """Centred text, shrunk until it fits max_width; cut with … if even min_size is too wide."""
    while size > min_size and pdfmetrics.stringWidth(text, font, size) > max_width:
        size -= 1
    while len(text) > 1 and pdfmetrics.stringWidth(text, font, size) > max_width:
        text = text[:-2] + "…"
    c.setFont(font, size)
    c.drawCentredString(x, y, text)


def render_certificate(path, cert: Certificate, event: Event, p: Participant):
    w, h = landscape(A4)
    c = canvas.Canvas(str(path), pagesize=(w, h))
    c.setTitle(f"Certificate No. {cert.certificate_no}")

    c.setStrokeColor(BRAND)
    c.setLineWidth(6)
    c.rect(24, 24, w - 48, h - 48)
    c.setStrokeColor(BRAND_LIGHT)
    c.setLineWidth(1.2)
    c.rect(36, 36, w - 72, h - 72)

    cx = w / 2
    max_w = w - 140  # inside the inner border with some margin
    d = event.event_date
    c.setFillColor(BRAND)
    c.setFont(SERIF_BOLD, 38)
    c.drawCentredString(cx, h - 130, "Certificate of Attendance")

    c.setFillColor(INK)
    draw_fitted(c, cx, h - 180, event.event_name, SANS_BOLD, 17, max_w)
    c.setFillColor(MUTED)
    draw_fitted(c, cx, h - 202, f"{event.venue} · {d.day} {d:%B %Y}", SANS, 12, max_w)

    c.setFillColor(INK)
    c.setFont(SERIF_ITALIC, 16)
    c.drawCentredString(cx, h - 265, "This is to certify that")
    draw_fitted(c, cx, h - 310, p.name, SERIF_BOLD, 32, max_w, min_size=16)
    c.setStrokeColor(BRAND_LIGHT)
    c.setLineWidth(1)
    c.line(cx - 200, h - 322, cx + 200, h - 322)

    line = p.designation + (f" · License No. {p.medical_license_no}" if p.medical_license_no else "")
    c.setFillColor(MUTED)
    draw_fitted(c, cx, h - 345, line, SANS, 12, max_w)
    credits = float(event.cme_credits)
    closing = "has attended the event named above"
    if credits > 0:
        closing += f" and is awarded {credits:g} CME credit{'' if credits == 1 else 's'}"
    c.setFillColor(INK)
    draw_fitted(c, cx, h - 385, closing + ".", SERIF, 16, max_w)

    c.setFillColor(MUTED)
    c.setFont(SANS, 10)
    c.drawString(60, 56, f"Certificate No. {cert.certificate_no}")
    c.save()


@router.post("/issue", status_code=201)
def issue(body: CertificateIssue, db: Session = Depends(get_db)):
    reg = db.get(Registration, body.registration_id)
    if not reg:
        raise HTTPException(404, "Registration not found")
    att = db.scalar(select(Attendance).where(Attendance.registration_id == reg.registration_id))
    eligible = (att and att.sign_out_time) or reg.manual_status == "present"
    if not eligible:
        raise HTTPException(400, "Not eligible: the participant hasn't signed out yet")
    event = db.get(Event, reg.event_id)
    participant = db.get(Participant, reg.participant_id)
    if event.cme_credits > 0 and not participant.medical_license_no:
        raise HTTPException(400, "Not eligible: medical license number is required for CME-credit events")

    # Lock the counter row so concurrent issues get consecutive numbers; the increment is
    # rolled back together with the insert if it fails.
    counter = db.scalar(
        select(EventCertificateCounter).where(EventCertificateCounter.event_id == event.event_id).with_for_update()
    )
    counter.last_no += 1
    n = counter.last_no
    cert = Certificate(certificate_no=f"{n:03d}", event_id=event.event_id, participant_id=participant.participant_id)
    db.add(cert)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Certificate already issued for this participant")
    db.refresh(cert)
    CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)
    render_certificate(CERTIFICATES_DIR / f"{cert.certificate_id}.pdf", cert, event, participant)
    db.commit()
    notify("certificates", cert.event_id)
    return row_to_dict(cert)


@router.get("")
def list_certificates(db: Session = Depends(get_db)):
    return [row_to_dict(c) for c in db.scalars(select(Certificate).order_by(Certificate.issued_at.desc()))]


def get_cert_or_404(db: Session, certificate_id: str) -> Certificate:
    cert = db.get(Certificate, certificate_id)
    if not cert:
        raise HTTPException(404, "Certificate not found")
    return cert


@router.get("/{certificate_id}")
def get_certificate(certificate_id: str, db: Session = Depends(get_db)):
    return row_to_dict(get_cert_or_404(db, certificate_id))


@router.get("/{certificate_id}/pdf")
def certificate_pdf(certificate_id: str, db: Session = Depends(get_db)):
    cert = get_cert_or_404(db, certificate_id)
    path = CERTIFICATES_DIR / f"{cert.certificate_id}.pdf"
    if not path.exists():  # e.g. data dir wiped: re-render from the DB
        render_certificate(path, cert, db.get(Event, cert.event_id), db.get(Participant, cert.participant_id))
    return FileResponse(path, media_type="application/pdf", filename=f"certificate_{cert.certificate_no}.pdf")
