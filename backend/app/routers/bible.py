from typing import List, Optional
import re
import html

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import aliased
from sqlmodel import Session, select
from sqlalchemy import or_

from ..dependencies import get_db, get_optional_user
from ..models import BibleVersion, Note, NoteCrossReference, User, Verse
from ..schemas import (
    BacklinkRead,
    BibleChapterResponse,
    BibleVersionRead,
    VerseRead,
    VerseWithBacklinks,
    ConcordanceResponse,
    ConcordanceHit,
)

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

    # Support simple book-name aliases (e.g., Psalms vs Psalm)
    aliases: dict[str, list[str]] = {
        "Psalms": ["Psalm"],
        "Psalm": ["Psalms"],
        # Song of Solomon aliases
        "Song of Solomon": ["Song of Songs", "Canticles", "Song", "Songs"],
        "Song of Songs": ["Song of Solomon", "Canticles", "Song", "Songs"],
        "Canticles": ["Song of Solomon", "Song of Songs", "Song", "Songs"],
        "Song": ["Songs", "Song of Solomon", "Song of Songs", "Canticles"],
        "Songs": ["Song", "Song of Solomon", "Song of Songs", "Canticles"],
    }

    candidates = [book]
    candidates.extend(aliases.get(book, []))

    verses = session.exec(
        select(Verse)
        .where(
            Verse.version_code == version_code,
            Verse.book.in_(candidates),
            Verse.chapter == chapter,
        )
        .order_by(Verse.verse)
    ).all()

    if not verses:
        # Fallback: normalize book names (strip non-alphanumerics, lowercase) and compare
        def _norm(s: str) -> str:
            raw = "".join(ch for ch in (s or "").lower() if ch.isalnum())
            # drop a leading 'the'
            return raw[3:] if raw.startswith("the") else raw

        norm_targets = {_norm(b) for b in candidates}
        rows = session.exec(
            select(Verse)
            .where(
                Verse.version_code == version_code,
                Verse.chapter == chapter,
            )
            .order_by(Verse.verse)
        ).all()
        verses = [v for v in rows if _norm(v.book) in norm_targets]

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


@router.get("/{version_code}/concordance", response_model=ConcordanceResponse)
def concordance(
    version_code: str,
    q: str,
    limit: int = 200,
    offset: int = 0,
    session: Session = Depends(get_db),
) -> ConcordanceResponse:
    version = session.get(BibleVersion, version_code)
    if not version:
        raise HTTPException(status_code=404, detail="Bible version not found")

    term = (q or "").strip()
    if not term:
        return ConcordanceResponse(query=q, version_code=version_code, total=0, total_occurrences=0, hits=[])

    # Pre-filter with LIKE for performance
    verses = session.exec(
        select(Verse)
        .where(
            Verse.version_code == version_code,
            Verse.text.ilike(f"%{term}%"),
        )
        .order_by(Verse.book, Verse.chapter, Verse.verse)
    ).all()

    # Prepare regexes
    try:
        pattern_word = re.compile(rf"\\b{re.escape(term)}\\b", flags=re.IGNORECASE)
    except re.error:
        pattern_word = None
    pattern_any = re.compile(re.escape(term), flags=re.IGNORECASE)

    hits_all: List[ConcordanceHit] = []
    total_occ = 0
    tag_re = re.compile(r"<[^>]+>")
    for v in verses:
        raw = v.text or ""
        # strip tags and unescape entities for more reliable matching
        cleaned = html.unescape(tag_re.sub(" ", raw))
        occ = 0
        if pattern_word is not None:
            occ = len(pattern_word.findall(cleaned))
        if occ <= 0:
            occ = len(pattern_any.findall(cleaned))
        if occ <= 0:
            continue
        total_occ += occ
        hits_all.append(ConcordanceHit(book=v.book, chapter=v.chapter, verse=v.verse, text=raw, occurrences=occ))

    # If LIKE-based prefilter missed due to markup/collation, fall back to scanning all verses
    if not hits_all:
        verses = session.exec(
            select(Verse)
            .where(Verse.version_code == version_code)
            .order_by(Verse.book, Verse.chapter, Verse.verse)
        ).all()
        for v in verses:
            raw = v.text or ""
            cleaned = html.unescape(tag_re.sub(" ", raw))
            occ = 0
            if pattern_word is not None:
                occ = len(pattern_word.findall(cleaned))
            if occ <= 0:
                occ = len(pattern_any.findall(cleaned))
            if occ <= 0:
                continue
            total_occ += occ
            hits_all.append(ConcordanceHit(book=v.book, chapter=v.chapter, verse=v.verse, text=raw, occurrences=occ))

    total = len(hits_all)
    paged = hits_all[offset : offset + limit]
    return ConcordanceResponse(
        query=term,
        version_code=version_code,
        total=total,
        total_occurrences=total_occ,
        hits=paged,
    )
