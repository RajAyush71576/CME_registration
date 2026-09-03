from fastapi import APIRouter, Depends, HTTPException

from app import excel_store as store
from app.auth import get_current_user
from app.schemas import Participant, ParticipantCreate

router = APIRouter(
    prefix="/participants",
    tags=["participants"],
    dependencies=[Depends(get_current_user)],
)


@router.post("", response_model=Participant, status_code=201)
def create_participant(payload: ParticipantCreate):
    row = {
        "participant_id": store.new_id(),
        "created_at": store.now_iso(),
        **payload.model_dump(),
    }
    store.append_row("Participants", row)
    return row


@router.get("", response_model=list[Participant])
def list_participants():
    return store.list_rows("Participants")


@router.get("/{participant_id}", response_model=Participant)
def get_participant(participant_id: str):
    row = store.find_row("Participants", "participant_id", participant_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Participant not found")
    return row
