from fastapi import APIRouter, Depends, HTTPException

from app import excel_store as store
from app.auth import get_current_user
from app.schemas import Event, EventCreate

router = APIRouter(
    prefix="/events", tags=["events"], dependencies=[Depends(get_current_user)]
)


def _to_row(event_id: str, payload: EventCreate) -> dict:
    data = payload.model_dump()
    data["event_date"] = data["event_date"].isoformat()
    data["organizing_doctors"] = ";".join(data["organizing_doctors"])
    return {"event_id": event_id, **data}


def _from_row(row: dict) -> dict:
    row = dict(row)
    doctors = row.get("organizing_doctors") or ""
    row["organizing_doctors"] = [d for d in doctors.split(";") if d]
    return row


@router.post("", response_model=Event, status_code=201)
def create_event(payload: EventCreate):
    row = _to_row(store.new_id(), payload)
    store.append_row("Events", row)
    return _from_row(row)


@router.get("", response_model=list[Event])
def list_events():
    return [_from_row(row) for row in store.list_rows("Events")]


@router.get("/{event_id}", response_model=Event)
def get_event(event_id: str):
    row = store.find_row("Events", "event_id", event_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return _from_row(row)
