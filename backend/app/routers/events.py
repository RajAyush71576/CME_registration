from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user, require_admin
from app.database import get_db
from app.db_utils import row_to_dict
from app.schemas import Event, EventCreate

router = APIRouter(
    prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)]
)


@router.post("", response_model=Event, status_code=201, dependencies=[Depends(require_admin)])
def create_event(payload: EventCreate, db: Session = Depends(get_db)):
    event = models.Event(**payload.model_dump())
    db.add(event)
    db.flush()
    db.add(models.EventCertificateCounter(event_id=event.event_id, last_no=0))
    db.commit()
    db.refresh(event)
    return row_to_dict(event)


@router.get("", response_model=list[Event])
def list_events(db: Session = Depends(get_db)):
    return [row_to_dict(e) for e in db.query(models.Event).all()]


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter_by(event_id=event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return row_to_dict(event)


@router.post(
    "/{event_id}/close", response_model=Event, dependencies=[Depends(require_admin)]
)
def close_event(event_id: str, db: Session = Depends(get_db)):
    event = db.query(models.Event).filter_by(event_id=event_id).first()
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.status == "closed":
        raise HTTPException(status_code=400, detail="Event is already closed")
    event.status = "closed"
    db.commit()
    db.refresh(event)
    return row_to_dict(event)
