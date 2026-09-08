from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.auth import get_current_user
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


@router.patch("/{participant_id}", response_model=Participant)
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
