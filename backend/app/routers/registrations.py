from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..live import notify
from ..db import get_db, row_to_dict
from ..models import Attendance, Certificate, Event, Participant, Registration, User
from ..schemas import RegistrationCreate
from ..security import get_current_user

router = APIRouter(prefix="/registrations", tags=["registrations"], dependencies=[Depends(get_current_user)])

LICENSE_REQUIRED = "Medical license number is required for CME-credit events"


def registration_details(db: Session, *filters) -> list[dict]:
    """Registration + nested participant, attendance (or None), certificate (or None),
    plus the names of the staff who registered / signed in / signed out."""
    users = {uid: (name, role) for uid, name, role in db.execute(select(User.user_id, User.name, User.role))}
    name = lambda uid: users.get(uid, (None, None))[0]
    role = lambda uid: users.get(uid, (None, None))[1]
    stmt = (
        select(Registration, Participant, Attendance, Certificate)
        .join(Participant, Participant.participant_id == Registration.participant_id)
        .outerjoin(Attendance, Attendance.registration_id == Registration.registration_id)
        .outerjoin(Certificate, and_(
            Certificate.event_id == Registration.event_id,
            Certificate.participant_id == Registration.participant_id,
        ))
        .where(*filters)
        .order_by(Participant.name)
    )
    return [
        {
            **row_to_dict(reg),
            "registered_by_name": name(reg.registered_by),
            "registered_by_role": role(reg.registered_by),
            "participant": row_to_dict(p),
            "attendance": {
                **row_to_dict(a),
                "signed_in_by_name": name(a.signed_in_by),
                "signed_in_by_role": role(a.signed_in_by),
                "signed_out_by_name": name(a.signed_out_by),
                "signed_out_by_role": role(a.signed_out_by),
            } if a else None,
            "certificate": row_to_dict(c) if c else None,
        }
        for reg, p, a, c in db.execute(stmt)
    ]


@router.post("", status_code=201)
def create_registration(body: RegistrationCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    participant = db.get(Participant, body.participant_id)
    if not participant:
        raise HTTPException(404, "Participant not found")
    event = db.get(Event, body.event_id)
    if not event:
        raise HTTPException(404, "Event not found")
    if event.status == "closed":
        raise HTTPException(400, "This event is closed")
    if event.cme_credits > 0 and not participant.medical_license_no:
        raise HTTPException(400, LICENSE_REQUIRED)
    # Only imports create website/import registrations; anything through this endpoint is on-spot.
    reg = Registration(**body.model_dump(), source="on_spot", registered_by=user.user_id)
    db.add(reg)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Participant is already registered for this event")
    db.refresh(reg)
    notify("registrations", reg.event_id)
    return row_to_dict(reg)


@router.get("")
def list_registrations(db: Session = Depends(get_db)):
    return [row_to_dict(r) for r in db.scalars(select(Registration).order_by(Registration.registered_at.desc()))]


@router.get("/by-event/{event_id}")
def by_event(event_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return registration_details(db, Registration.event_id == event_id)


@router.get("/search")
def search(event_id: str, q: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    q = q.strip()
    ql = q.lower()
    return registration_details(
        db,
        Registration.event_id == event_id,
        or_(
            func.lower(Registration.registration_id) == ql,
            func.lower(Participant.phone) == ql,
            func.lower(Participant.email) == ql,
            func.lower(Participant.whatsapp_number) == ql,
            # Numbers are stored as "+91 9876543210"; let staff type just the number.
            Participant.phone.endswith(f" {q}", autoescape=True),
            Participant.whatsapp_number.endswith(f" {q}", autoescape=True),
            Participant.name.icontains(q, autoescape=True),
        ),
    )


@router.get("/{registration_id}")
def get_registration(registration_id: str, db: Session = Depends(get_db)):
    reg = db.get(Registration, registration_id)
    if not reg:
        raise HTTPException(404, "Registration not found")
    return row_to_dict(reg)
