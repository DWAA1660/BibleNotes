from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import aliased
from sqlmodel import Session, select

from ..dependencies import get_db, get_optional_user
from ..models import BibleVersion, Note, NoteCrossReference, User, Verse
from ..schemas import BacklinkRead, BibleChapterResponse, BibleVersionRead, VerseRead, VerseWithBacklinks

router = APIRouter(prefix="/bible", tags=["bible"])


@router.get("/versions", response_model=List[BibleVersionRead])
def list_versions(session: Session = Depends(get_db)) -> List[BibleVersionRead]:
    versions = session.exec(select(BibleVersion).order_by(BibleVersion.code)).all()
    return [BibleVersionRead.from_orm(version) for version in versions]


@router.get("/{version_code}/{book}/{chapter}", response_model=BibleChapterResponse)
def read_chapter(
    version_code: str,
    book: str,
    chapter: int,
    session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> BibleChapterResponse:
    version = session.get(BibleVersion, version_code)
    if not version:
        raise HTTPException(status_code=404, detail="Bible version not found")

    verses = session.exec(
        select(Verse)
        .where(
            Verse.version_code == version_code,
            Verse.book == book,
            Verse.chapter == chapter,
        )
        .order_by(Verse.verse)
    ).all()

    if not verses:
        raise HTTPException(status_code=404, detail="Chapter not found")

    verse_ids = [verse.id for verse in verses]

    backlinks_map: dict[int, list[BacklinkRead]] = {vid: [] for vid in verse_ids}

    if verse_ids:
        results = session.exec(
            select(NoteCrossReference, Note, User)
            .join(Note, Note.id == NoteCrossReference.note_id)
            .join(User, User.id == Note.owner_id)
            .where(NoteCrossReference.target_verse_id.in_(verse_ids))
        ).all()

        for cross_ref, note, owner in results:
            if not note.is_public and (not current_user or note.owner_id != current_user.id):
                continue
            backlinks_map[cross_ref.target_verse_id].append(
                BacklinkRead(
                    note_id=note.id,
                    note_title=note.title,
                    note_owner_name=owner.display_name or owner.email,
                    note_owner_id=owner.id,
                    note_is_public=note.is_public,
                )
            )

    verse_payloads = [
        VerseWithBacklinks(
            **VerseRead.from_orm(verse).dict(),
            backlinks=backlinks_map.get(verse.id, []),
        )
        for verse in verses
    ]

    return BibleChapterResponse(
        version=BibleVersionRead.from_orm(version),
        book=book,
        chapter=chapter,
        verses=verse_payloads,
    )
