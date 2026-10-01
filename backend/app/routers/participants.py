<<<<<<< HEAD
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
=======
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_staff
from app.database import get_db
from app.db_utils import row_to_dict
from app.schemas import Participant, ParticipantCreate, ParticipantUpdate

router = APIRouter(
    prefix="/participants",
    tags=["participants"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=Participant, status_code=201)
def create_participant(payload: ParticipantCreate, db: Session = Depends(get_db)):
    participant = models.Participant(**payload.model_dump())
    db.add(participant)
    db.commit()
    db.refresh(participant)
    return row_to_dict(participant)


@router.get("", response_model=list[Participant])
def list_participants(db: Session = Depends(get_db)):
    return [row_to_dict(p) for p in db.query(models.Participant).all()]


@router.get("/{participant_id}", response_model=Participant)
def get_participant(participant_id: str, db: Session = Depends(get_db)):
    participant = db.query(models.Participant).filter_by(participant_id=participant_id).first()
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    return row_to_dict(participant)


@router.patch("/{participant_id}", response_model=Participant, dependencies=[Depends(require_staff)])
def update_participant(
    participant_id: str, payload: ParticipantUpdate, db: Session = Depends(get_db)
):
    participant = db.query(models.Participant).filter_by(participant_id=participant_id).first()
    if participant is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(participant, field, value)
    db.commit()
    db.refresh(participant)
    return row_to_dict(participant)
>>>>>>> f6417903ef485a178711941303c1c7bbbf4c6de5
