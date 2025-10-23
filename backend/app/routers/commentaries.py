from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..dependencies import get_current_user, get_db, get_optional_user
from ..models import Commentary, CommentaryEntry, User, UserCommentarySubscription, Verse
from ..schemas import (
    CommentaryCreate,
    CommentaryEntryCreate,
    CommentaryEntryRead,
    CommentaryEntryResponse,
    CommentaryEntryUpdate,
    CommentaryListResponse,
    CommentaryRead,
    CommentarySearchResult,
    CommentarySubscriptionRead,
    CommentaryUpdate,
)
from ..utils.markdown import render_markdown

router = APIRouter(prefix="/commentaries", tags=["commentaries"])


def serialize_commentary(commentary: Commentary) -> CommentaryRead:
    return CommentaryRead(
        id=commentary.id,
        title=commentary.title,
        description=commentary.description,
        is_public=commentary.is_public,
        owner_id=commentary.owner_id,
        owner_display_name=commentary.owner.display_name if commentary.owner else None,
    )


def serialize_entry(entry: CommentaryEntry) -> CommentaryEntryRead:
    return CommentaryEntryRead(
        id=entry.id,
        commentary_id=entry.commentary_id,
        verse_id=entry.verse_id,
        content_markdown=entry.content_markdown,
        content_html=entry.content_html,
        created_at=entry.created_at,
        updated_at=entry.updated_at,
    )


@router.post("", response_model=CommentaryRead, status_code=status.HTTP_201_CREATED)
def create_commentary(
    payload: CommentaryCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentaryRead:
    commentary = Commentary(
        owner_id=current_user.id,
        title=payload.title,
        description=payload.description,
        is_public=payload.is_public,
    )
    session.add(commentary)
    session.commit()
    session.refresh(commentary)
    return serialize_commentary(commentary)


@router.get("", response_model=CommentaryListResponse)
def list_my_commentaries(
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentaryListResponse:
    commentaries = session.exec(
        select(Commentary)
        .where(Commentary.owner_id == current_user.id)
        .options(selectinload(Commentary.owner))
        .order_by(Commentary.title)
    ).all()
    return CommentaryListResponse(commentaries=[serialize_commentary(c) for c in commentaries])


@router.get("/public", response_model=List[CommentarySearchResult])
def search_public_commentaries(
    query: Optional[str] = None,
    session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> List[CommentarySearchResult]:
    stmt = (
        select(Commentary)
        .where(Commentary.is_public.is_(True))
        .options(selectinload(Commentary.owner))
    )

    if query:
        like = f"%{query}%"
        # Also search by commentator (owner) display name or email
        stmt = (
            stmt.join(User, User.id == Commentary.owner_id)
            .where(
                Commentary.title.ilike(like)
                | Commentary.description.ilike(like)
                | User.display_name.ilike(like)
                | User.email.ilike(like)
            )
        )

    commentaries = session.exec(stmt.order_by(Commentary.title)).all()

    results: List[CommentarySearchResult] = []
    for commentary in commentaries:
        results.append(
            CommentarySearchResult(
                id=commentary.id,
                title=commentary.title,
                description=commentary.description,
                owner_display_name=commentary.owner.display_name if commentary.owner else None,
            )
        )
    return results


@router.put("/{commentary_id}", response_model=CommentaryRead)
def update_commentary(
    commentary_id: int,
    payload: CommentaryUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentaryRead:
    commentary = session.get(Commentary, commentary_id)
    if not commentary or commentary.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Commentary not found")

    if payload.title is not None:
        commentary.title = payload.title
    if payload.description is not None:
        commentary.description = payload.description
    if payload.is_public is not None:
        commentary.is_public = payload.is_public

    session.add(commentary)
    session.commit()
    session.refresh(commentary)

    return serialize_commentary(commentary)


@router.delete("/{commentary_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commentary(
    commentary_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    commentary = session.get(Commentary, commentary_id)
    if not commentary or commentary.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Commentary not found")
    session.delete(commentary)
    session.commit()


@router.post("/{commentary_id}/entries", response_model=CommentaryEntryRead, status_code=status.HTTP_201_CREATED)
def create_commentary_entry(
    commentary_id: int,
    payload: CommentaryEntryCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentaryEntryRead:
    commentary = session.get(Commentary, commentary_id)
    if not commentary or commentary.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Commentary not found")

    verse = session.get(Verse, payload.verse_id)
    if not verse:
        raise HTTPException(status_code=400, detail="Verse not found")

    entry = CommentaryEntry(
        commentary_id=commentary_id,
        verse_id=payload.verse_id,
        content_markdown=payload.content_markdown,
        content_html=render_markdown(payload.content_markdown),
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)

    return serialize_entry(entry)


@router.put("/{commentary_id}/entries/{entry_id}", response_model=CommentaryEntryRead)
def update_commentary_entry(
    commentary_id: int,
    entry_id: int,
    payload: CommentaryEntryUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentaryEntryRead:
    entry = session.exec(
        select(CommentaryEntry)
        .join(Commentary, Commentary.id == CommentaryEntry.commentary_id)
        .where(CommentaryEntry.id == entry_id, CommentaryEntry.commentary_id == commentary_id)
    ).first()

    if not entry or entry.commentary.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Entry not found")

    if payload.content_markdown is not None:
        entry.content_markdown = payload.content_markdown
        entry.content_html = render_markdown(payload.content_markdown)

    session.add(entry)
    session.commit()
    session.refresh(entry)

    return serialize_entry(entry)


@router.delete("/{commentary_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_commentary_entry(
    commentary_id: int,
    entry_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    entry = session.exec(
        select(CommentaryEntry)
        .join(Commentary, Commentary.id == CommentaryEntry.commentary_id)
        .where(CommentaryEntry.id == entry_id, CommentaryEntry.commentary_id == commentary_id)
    ).first()

    if not entry or entry.commentary.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Entry not found")

    session.delete(entry)
    session.commit()


@router.post("/{commentary_id}/subscribe", response_model=CommentarySubscriptionRead)
def subscribe_commentary(
    commentary_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CommentarySubscriptionRead:
    commentary = session.get(Commentary, commentary_id)
    if not commentary or (not commentary.is_public and commentary.owner_id != current_user.id):
        raise HTTPException(status_code=404, detail="Commentary not available")

    existing = session.exec(
        select(UserCommentarySubscription).where(
            UserCommentarySubscription.user_id == current_user.id,
            UserCommentarySubscription.commentary_id == commentary_id,
        )
    ).first()

    if existing:
        return CommentarySubscriptionRead(
            commentary_id=existing.commentary_id,
            commentary_title=commentary.title,
            owner_id=commentary.owner_id,
            owner_display_name=commentary.owner.display_name if commentary.owner else None,
        )

    subscription = UserCommentarySubscription(user_id=current_user.id, commentary_id=commentary_id)
    session.add(subscription)
    session.commit()
    session.refresh(subscription)

    return CommentarySubscriptionRead(
        commentary_id=commentary_id,
        commentary_title=commentary.title,
        owner_id=commentary.owner_id,
        owner_display_name=commentary.owner.display_name if commentary.owner else None,
    )


@router.get("/subscriptions", response_model=List[CommentarySubscriptionRead])
def get_subscriptions(
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> List[CommentarySubscriptionRead]:
    subs = session.exec(
        select(UserCommentarySubscription)
        .where(UserCommentarySubscription.user_id == current_user.id)
        .options(selectinload(UserCommentarySubscription.commentary).selectinload(Commentary.owner))
    ).all()

    results: List[CommentarySubscriptionRead] = []
    for sub in subs:
        commentary = sub.commentary
        results.append(
            CommentarySubscriptionRead(
                commentary_id=sub.commentary_id,
                commentary_title=commentary.title,
                owner_id=commentary.owner_id,
                owner_display_name=commentary.owner.display_name if commentary.owner else None,
            )
        )
    return results


@router.get("/{commentary_id}/entries", response_model=CommentaryEntryResponse)
def list_entries(
    commentary_id: int,
    verse_id: Optional[int] = None,
    session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> CommentaryEntryResponse:
    commentary = session.exec(
        select(Commentary)
        .where(Commentary.id == commentary_id)
        .options(selectinload(Commentary.owner))
    ).first()

    if not commentary:
        raise HTTPException(status_code=404, detail="Commentary not found")

    if not commentary.is_public:
        if not current_user or commentary.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this commentary")

    stmt = select(CommentaryEntry).where(CommentaryEntry.commentary_id == commentary_id)
    if verse_id is not None:
        stmt = stmt.where(CommentaryEntry.verse_id == verse_id)
    entries = session.exec(stmt.order_by(CommentaryEntry.created_at.desc())).all()

    return CommentaryEntryResponse(entries=[serialize_entry(entry) for entry in entries])
