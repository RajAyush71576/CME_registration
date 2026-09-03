"""Renders certificate PDFs.

Placeholder layout — swap this for the actual approved template/logo once
supplied (see CONTEXT.md §8: "The approved template is reused; event-specific
name/logo fields change per event.").
"""

from pathlib import Path

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas

CERTIFICATES_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "certificates"


def render_certificate_pdf(
    certificate_id: str, certificate_no: str, event: dict, participant: dict
) -> Path:
    CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)
    path = CERTIFICATES_DIR / f"{certificate_id}.pdf"

    c = canvas.Canvas(str(path), pagesize=landscape(A4))
    width, height = landscape(A4)

    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height - 100, "Certificate of Attendance")

    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 150, event["event_name"])
    c.drawCentredString(
        width / 2, height - 175, f"{event['venue']} · {event['event_date']}"
    )

    c.setFont("Helvetica", 16)
    c.drawCentredString(width / 2, height - 230, "This certifies that")

    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(width / 2, height - 265, participant["name"])

    detail = participant["designation"]
    if participant.get("medical_license_no"):
        detail += f" · License No. {participant['medical_license_no']}"
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 290, detail)

    c.drawCentredString(width / 2, height - 320, "has attended the above event.")

    c.setFont("Helvetica", 12)
    c.drawString(60, 60, f"Certificate No. {certificate_no}")

    c.save()
    return path
