"""Generates the colored CME observer attendance sheet (CONTEXT.md §9).

Lists only registrants who completed sign-out (i.e. met the event's
approximate duration requirement) — the observer batch-signs this one sheet
rather than signing off each registrant individually.
"""

import io

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

HEADER_COLOR = colors.HexColor("#6D28D9")
ROW_ALT_COLOR = colors.HexColor("#F3E8FF")


def render_observer_sheet_pdf(event: dict, rows: list[dict]) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, topMargin=1.5 * cm, bottomMargin=1.5 * cm)
    styles = getSampleStyleSheet()

    elements = [
        Paragraph("CME Observer Attendance Sheet", styles["Title"]),
        Paragraph(
            f"{event['event_name']} | {event['event_date']} | {event['venue']}",
            styles["Normal"],
        ),
        Paragraph(f"Department: {event['department']}", styles["Normal"]),
        Spacer(1, 0.5 * cm),
    ]

    table_data = [["#", "Name", "Designation", "Type", "Sign-in", "Sign-out"]]
    for i, row in enumerate(rows, start=1):
        table_data.append(
            [
                str(i),
                row["name"],
                row["designation"],
                row["participant_type"],
                row["sign_in_time"],
                row["sign_out_time"],
            ]
        )

    table = Table(table_data, repeatRows=1)
    style = [
        ("BACKGROUND", (0, 0), (-1, 0), HEADER_COLOR),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]
    for i in range(1, len(table_data)):
        if i % 2 == 0:
            style.append(("BACKGROUND", (0, i), (-1, i), ROW_ALT_COLOR))
    table.setStyle(TableStyle(style))
    elements.append(table)

    elements.append(Spacer(1, 1.5 * cm))
    elements.append(
        Paragraph(f"Total eligible for sign-off: {len(rows)}", styles["Normal"])
    )
    elements.append(Spacer(1, 1 * cm))
    elements.append(Paragraph("Observer batch sign-off:", styles["Normal"]))
    elements.append(Spacer(1, 1.5 * cm))
    elements.append(
        Paragraph(
            "Signature: _______________________&nbsp;&nbsp;&nbsp;&nbsp;Date: _______________",
            styles["Normal"],
        )
    )

    doc.build(elements)
    buf.seek(0)
    return buf.read()
