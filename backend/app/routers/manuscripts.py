from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from ..dependencies import get_db
from ..models import ManuscriptBookCoverage, ManuscriptEdition, ManuscriptVerse
from ..schemas import (
    ManuscriptChapterResponse,
    ManuscriptEditionListResponse,
    ManuscriptEditionRead,
    ManuscriptVerseRead,
)
from ..utils.reference_parser import normalize_book

router = APIRouter(prefix="/manuscripts", tags=["manuscripts"])


@router.get("/editions", response_model=ManuscriptEditionListResponse)
def list_editions(
    language: Optional[str] = Query(None, description="Filter by language code e.g. grc, heb, syr"),
    scope: Optional[str] = Query(None, description="Filter by scope e.g. OT, NT, LXX, FULL"),
    session: Session = Depends(get_db),
) -> ManuscriptEditionListResponse:
    stmt = select(ManuscriptEdition)
    if language:
        stmt = stmt.where(ManuscriptEdition.language == language)
    if scope:
        stmt = stmt.where(ManuscriptEdition.scope == scope)
    stmt = stmt.order_by(ManuscriptEdition.code)
    editions = session.exec(stmt).all()
    return ManuscriptEditionListResponse(editions=[ManuscriptEditionRead.from_orm(e) for e in editions])


@router.get("/available/{book}/{chapter}", response_model=ManuscriptEditionListResponse)
def list_available_for_passage(
    book: str,
    chapter: int,
    language: Optional[str] = Query(None),
    session: Session = Depends(get_db),
) -> ManuscriptEditionListResponse:
    canonical_book = normalize_book(book)
    stmt = (
        select(ManuscriptEdition)
        .join(ManuscriptBookCoverage, ManuscriptBookCoverage.edition_code == ManuscriptEdition.code)
        .where(ManuscriptBookCoverage.book == canonical_book)
        .order_by(ManuscriptEdition.code)
    )
    if language:
        stmt = stmt.where(ManuscriptEdition.language == language)
    editions = session.exec(stmt).all()
    return ManuscriptEditionListResponse(editions=[ManuscriptEditionRead.from_orm(e) for e in editions])


@router.get("/{edition_code}/{book}/{chapter}", response_model=ManuscriptChapterResponse)
def read_manuscript_chapter(
    edition_code: str,
    book: str,
    chapter: int,
    session: Session = Depends(get_db),
) -> ManuscriptChapterResponse:
    edition = session.get(ManuscriptEdition, edition_code)
    if not edition:
        raise HTTPException(status_code=404, detail="Manuscript edition not found")

    canonical_book = normalize_book(book)
    verses = session.exec(
        select(ManuscriptVerse)
        .where(
            ManuscriptVerse.edition_code == edition_code,
            ManuscriptVerse.book == canonical_book,
            ManuscriptVerse.chapter == chapter,
        )
        .order_by(ManuscriptVerse.verse)
    ).all()

    if not verses:
        raise HTTPException(status_code=404, detail="Chapter not found")

    return ManuscriptChapterResponse(
        edition=ManuscriptEditionRead.from_orm(edition),
        book=book,
        chapter=chapter,
        verses=[ManuscriptVerseRead.from_orm(v) for v in verses],
    )
