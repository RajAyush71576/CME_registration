from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from ..live import notify
from ..db import get_db, row_to_dict
from ..models import Attendance, Certificate, Event, Participant, Registration, User
from ..schemas import ParticipantCreate, ParticipantUpdate
from ..security import get_current_user, require_admin
from .imports import LABELS

router = APIRouter(prefix="/participants", tags=["participants"], dependencies=[Depends(get_current_user)])

REQUIRED = {"name", "designation", "email", "phone", "whatsapp_number", "place_of_work", "participant_type"}


def get_participant_or_404(db: Session, participant_id: str) -> Participant:
    p = db.get(Participant, participant_id)
    if not p:
        raise HTTPException(404, "Participant not found")
    return p


@router.post("", status_code=201)
def create_participant(body: ParticipantCreate, response: Response, db: Session = Depends(get_db)):
    # Same email = same person (as imports do): hand back the existing record instead of a duplicate.
    # ponytail: first match wins if older data already has duplicates; merge them by hand if that matters.
    existing = db.scalar(select(Participant).where(func.lower(Participant.email) == body.email.lower()).limit(1))
    if existing:
        response.status_code = 200
        return {**row_to_dict(existing), "existing": True}
    p = Participant(**body.model_dump(), source="on_spot")
    db.add(p)
    db.commit()
    db.refresh(p)
    return {**row_to_dict(p), "existing": False}


@router.get("", dependencies=[Depends(require_admin)])  # Participants page is admin-only
def list_participants(db: Session = Depends(get_db)):
    """Every participant, each with the events they're registered for and how their attendance stands there."""
    events: dict[str, list[dict]] = {}
    rows = db.execute(
        select(Registration.participant_id, Event, Attendance)
        .join(Event, Event.event_id == Registration.event_id)
        .outerjoin(Attendance, Attendance.registration_id == Registration.registration_id)
        .order_by(Event.event_date, Event.event_name)
    )
    for pid, ev, att in rows:
        attendance = ("completed" if att.sign_out_time else "signed_in") if att else ("absent" if ev.status == "closed" else "not_signed_in")
        events.setdefault(pid, []).append({
            "event_id": ev.event_id, "event_name": ev.event_name, "event_date": ev.event_date,
            "event_status": ev.status, "attendance": attendance,
        })
    return [
        {**row_to_dict(p), "events": events.get(p.participant_id, [])}
        for p in db.scalars(select(Participant).order_by(Participant.name))
    ]


@router.get("/{participant_id}", dependencies=[Depends(require_admin)])
def get_participant(participant_id: str, db: Session = Depends(get_db)):
    return row_to_dict(get_participant_or_404(db, participant_id))


@router.patch("/{participant_id}")
def update_participant(
    participant_id: str, body: ParticipantUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)
):
    p = get_participant_or_404(db, participant_id)
    changes = body.model_dump(exclude_unset=True)
    cleared = [LABELS[k] for k, v in changes.items() if v is None and k in REQUIRED]
    if cleared:
        raise HTTPException(400, f"These fields cannot be empty: {', '.join(sorted(cleared))}")
    # The name is printed on certificates; once one exists only an admin may change it.
    if (user.role != "admin" and changes.get("name") not in (None, p.name)
            and db.scalar(select(exists().where(Certificate.participant_id == p.participant_id)))):
        raise HTTPException(400, "Name can't be changed after a certificate has been issued — ask an admin")
    for k, v in changes.items():
        setattr(p, k, v)
    db.commit()
    notify("participants")  # a participant can be in several events
    return row_to_dict(p)
