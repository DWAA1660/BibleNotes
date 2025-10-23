from urllib.parse import quote_plus

from fastapi import APIRouter, Depends
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..dependencies import get_current_user, get_db
from ..models import Note, User
from ..schemas import UserProfileRead
from .notes import serialize_note

router = APIRouter(prefix="/users", tags=["users"])


def _default_avatar_url(user: User) -> str:
    name_source = user.display_name or user.email
    initials = "".join(part[0] for part in name_source.split() if part).upper()
    if not initials:
        initials = "U"
    params = quote_plus(initials)
    return f"https://ui-avatars.com/api/?name={params}&background=1f2937&color=ffffff"


@router.get("/me/profile", response_model=UserProfileRead)
def read_my_profile(
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserProfileRead:
    notes = session.exec(
        select(Note)
        .options(
            selectinload(Note.owner),
            selectinload(Note.cross_references),
            selectinload(Note.anchor_start),
            selectinload(Note.anchor_end),
        )
        .where(Note.owner_id == current_user.id)
        .order_by(Note.created_at.desc())
    ).all()

    serialized_notes = [serialize_note(note) for note in notes]

    return UserProfileRead(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        avatar_url=_default_avatar_url(current_user),
        note_count=len(serialized_notes),
        notes=serialized_notes,
    )
