from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import exists, func, select
from sqlalchemy.orm import Session

from ..live import notify
from ..db import get_db, row_to_dict
from ..models import Attendance, Event, EventCertificateCounter, Participant, Registration
from ..schemas import EventCreate, EventUpdate
from ..security import get_current_user, require_admin

router = APIRouter(prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)])


def get_event_or_404(db: Session, event_id: str) -> Event:
    event = db.get(Event, event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    return event


@router.post("", status_code=201, dependencies=[Depends(require_admin)])
def create_event(body: EventCreate, db: Session = Depends(get_db)):
    event = Event(**body.model_dump())
    db.add(event)
    db.flush()
    db.add(EventCertificateCounter(event_id=event.event_id, last_no=0))
    db.commit()
    db.refresh(event)
    notify("events", event.event_id)
    return row_to_dict(event)


@router.get("")
def list_events(db: Session = Depends(get_db)):
    return [row_to_dict(e) for e in db.scalars(select(Event).order_by(Event.event_date.desc()))]


@router.get("/{event_id}")
def get_event(event_id: str, db: Session = Depends(get_db)):
    return row_to_dict(get_event_or_404(db, event_id))


@router.patch("/{event_id}", dependencies=[Depends(require_admin)])
def update_event(event_id: str, body: EventUpdate, db: Session = Depends(get_db)):
    event = get_event_or_404(db, event_id)
    if event.status == "closed":
        raise HTTPException(400, "Closed events can't be edited")
    started = db.scalar(select(exists().where(
        Attendance.registration_id == Registration.registration_id, Registration.event_id == event_id,
    )))
    if started:
        raise HTTPException(400, "This event can no longer be edited — a participant has already signed in")
    changes = body.model_dump(exclude_unset=True, exclude_none=True)
    if changes.get("cme_credits", 0) > 0 and not event.cme_credits > 0:
        # Turning on CME credits: everyone registered needs a license number (same rule as registering).
        missing = db.scalar(
            select(func.count()).select_from(Registration)
            .join(Participant, Participant.participant_id == Registration.participant_id)
            .where(Registration.event_id == event_id,
                   (Participant.medical_license_no.is_(None)) | (Participant.medical_license_no == ""))
        )
        if missing:
            raise HTTPException(400, f"Can't add CME credits yet: {missing} registered participant"
                                     f"{'s have' if missing != 1 else ' has'} no medical license number. Add it first.")
    for k, v in changes.items():
        setattr(event, k, v)
    db.commit()
    notify("events", event.event_id)
    return row_to_dict(event)


@router.post("/{event_id}/close", dependencies=[Depends(require_admin)])
def close_event(event_id: str, db: Session = Depends(get_db)):
    event = get_event_or_404(db, event_id)
    if event.status == "closed":
        raise HTTPException(400, "Event is already closed")
    event.status = "closed"
    db.commit()
    notify("events", event.event_id)
    return row_to_dict(event)
