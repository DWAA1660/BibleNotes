from urllib.parse import quote_plus

from fastapi import APIRouter, Depends
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..dependencies import get_current_user, get_db
from ..models import Note, User
from ..schemas import (
    UserProfileRead,
    UserListResponse,
    UserSearchResult,
    AuthorSubscriptionListResponse,
    AuthorSubscriptionRead,
)
from ..models import UserNoteSubscription
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
    tag: str | None = None,
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

    if tag:
        t = tag.strip().lower()
        if t:
            notes = [
                n for n in notes
                if (n.tags_text == t)
                or n.tags_text.startswith(f"{t},")
                or f",{t}," in n.tags_text
                or n.tags_text.endswith(f",{t}")
            ]

    serialized_notes = [serialize_note(session, note) for note in notes]

    return UserProfileRead(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        avatar_url=_default_avatar_url(current_user),
        note_count=len(serialized_notes),
        notes=serialized_notes,
    )


@router.get("/search", response_model=UserListResponse)
def search_users(
    query: str | None = None,
    session: Session = Depends(get_db),
) -> UserListResponse:
    if not query or not query.strip():
        return UserListResponse(users=[])

    like = f"%{query}%"
    users = session.exec(
        select(User)
        .where((User.display_name.ilike(like)) | (User.email.ilike(like)))
        .order_by(User.display_name.is_(None), User.display_name, User.email)
    ).all()

    results = [
        UserSearchResult(
            id=u.id,
            email=u.email,
            display_name=u.display_name,
        )
        for u in users
    ]

    return UserListResponse(users=results)


@router.get("/{user_id}/subscriptions", response_model=AuthorSubscriptionListResponse)
def read_user_subscriptions(
    user_id: int,
    session: Session = Depends(get_db),
):
    subs = session.exec(
        select(UserNoteSubscription)
        .where(UserNoteSubscription.subscriber_id == user_id)
        .options(selectinload(UserNoteSubscription.author))
    ).all()

    subscriptions: list[AuthorSubscriptionRead] = []
    for sub in subs:
        if not sub.author:
            continue
        subscriptions.append(
            AuthorSubscriptionRead(
                author_id=sub.author_id,
                author_display_name=sub.author.display_name or sub.author.email,
            )
        )

    return AuthorSubscriptionListResponse(subscriptions=subscriptions)
