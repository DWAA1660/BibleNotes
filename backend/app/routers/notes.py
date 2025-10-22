from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import selectinload
from sqlmodel import Session, select

from ..dependencies import get_current_user, get_db, get_optional_user
from ..models import Note, NoteCrossReference, User, Verse
from ..schemas import (
    BacklinksResponse,
    BacklinkRead,
    NoteCreate,
    NoteRead,
    NoteUpdate,
    NotesResponse,
)
from ..utils.markdown import render_markdown
from ..utils.reference_parser import extract_canonical_ids

router = APIRouter(prefix="/notes", tags=["notes"])


def serialize_note(note: Note) -> NoteRead:
    return NoteRead(
        id=note.id,
        title=note.title,
        content_markdown=note.content_markdown,
        content_html=note.content_html,
        version_code=note.version_code,
        start_verse_id=note.start_verse_id,
        end_verse_id=note.end_verse_id,
        is_public=note.is_public,
        owner_id=note.owner_id,
        owner_display_name=(note.owner.display_name or note.owner.email) if note.owner else None,
        created_at=note.created_at,
        updated_at=note.updated_at,
        cross_references=[ref.canonical_id for ref in note.cross_references],
    )


def apply_cross_references(session: Session, note: Note, version_code: str) -> None:
    canonical_ids = list(dict.fromkeys(extract_canonical_ids(note.content_markdown)))
    note.cross_references.clear()

    if not canonical_ids:
        return

    target_verses = session.exec(
        select(Verse).where(Verse.version_code == version_code, Verse.canonical_id.in_(canonical_ids))
    ).all()

    verse_map = {verse.canonical_id: verse for verse in target_verses}

    for canonical_id in canonical_ids:
        verse = verse_map.get(canonical_id)
        if not verse:
            continue
        note.cross_references.append(
            NoteCrossReference(canonical_id=canonical_id, target_verse_id=verse.id)
        )


@router.get("/{version_code}/{book}/{chapter}", response_model=NotesResponse)
def list_notes(
    version_code: str,
    book: str,
    chapter: int,
    session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> NotesResponse:
    stmt = (
        select(Note)
        .options(
            selectinload(Note.owner),
            selectinload(Note.cross_references),
            selectinload(Note.anchor_start),
            selectinload(Note.anchor_end),
        )
        .join(Verse, Note.start_verse_id == Verse.id)
        .where(
            Note.version_code == version_code,
            Verse.book == book,
            Verse.chapter == chapter,
        )
        .order_by(Note.created_at.desc())
    )

    notes = session.exec(stmt).all()

    visible_notes: List[Note] = []
    for note in notes:
        if note.is_public:
            visible_notes.append(note)
        elif current_user and note.owner_id == current_user.id:
            visible_notes.append(note)

    return NotesResponse(notes=[serialize_note(note) for note in visible_notes])


@router.post("", response_model=NoteRead, status_code=status.HTTP_201_CREATED)
def create_note(
    payload: NoteCreate,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NoteRead:
    start_verse = session.get(Verse, payload.start_verse_id)
    end_verse = session.get(Verse, payload.end_verse_id)

    if not start_verse or not end_verse:
        raise HTTPException(status_code=400, detail="Invalid verse range")

    if start_verse.version_code != payload.version_code or end_verse.version_code != payload.version_code:
        raise HTTPException(status_code=400, detail="Verse version mismatch")

    if start_verse.book != end_verse.book:
        raise HTTPException(status_code=400, detail="Notes must stay within a single book")

    if (start_verse.chapter, start_verse.verse) > (end_verse.chapter, end_verse.verse):
        raise HTTPException(status_code=400, detail="Start verse must be before end verse")

    content_html = render_markdown(payload.content_markdown)

    note = Note(
        owner_id=current_user.id,
        title=payload.title,
        content_markdown=payload.content_markdown,
        content_html=content_html,
        version_code=payload.version_code,
        start_verse_id=payload.start_verse_id,
        end_verse_id=payload.end_verse_id,
        is_public=payload.is_public,
    )
    session.add(note)
    session.flush()

    apply_cross_references(session, note, payload.version_code)

    session.add(note)
    session.commit()
    session.refresh(note)

    return serialize_note(note)


@router.put("/{note_id}", response_model=NoteRead)
def update_note(
    note_id: int,
    payload: NoteUpdate,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> NoteRead:
    note = session.exec(
        select(Note)
        .options(
            selectinload(Note.cross_references),
            selectinload(Note.owner),
            selectinload(Note.anchor_start),
            selectinload(Note.anchor_end),
        )
        .where(Note.id == note_id)
    ).first()

    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")

    if payload.title is not None:
        note.title = payload.title

    if payload.content_markdown is not None:
        note.content_markdown = payload.content_markdown
        note.content_html = render_markdown(payload.content_markdown)
        apply_cross_references(session, note, note.version_code)

    if payload.is_public is not None:
        note.is_public = payload.is_public

    if payload.end_verse_id is not None:
        end_verse = session.get(Verse, payload.end_verse_id)
        if not end_verse or end_verse.version_code != note.version_code:
            raise HTTPException(status_code=400, detail="Invalid end verse")
        if end_verse.book != note.anchor_start.book:
            raise HTTPException(status_code=400, detail="Notes must stay within a single book")
        if (note.anchor_start.chapter, note.anchor_start.verse) > (end_verse.chapter, end_verse.verse):
            raise HTTPException(status_code=400, detail="End verse must be after start verse")
        note.end_verse_id = payload.end_verse_id

    session.add(note)
    session.commit()
    session.refresh(note)

    return serialize_note(note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_note(
    note_id: int,
    session: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    note = session.get(Note, note_id)
    if not note or note.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Note not found")
    session.delete(note)
    session.commit()


@router.get("/backlinks/{version_code}/{book}/{chapter}/{verse}", response_model=BacklinksResponse)
def get_backlinks(
    version_code: str,
    book: str,
    chapter: int,
    verse: int,
    session: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
) -> BacklinksResponse:
    verse_obj = session.exec(
        select(Verse).where(
            Verse.version_code == version_code,
            Verse.book == book,
            Verse.chapter == chapter,
            Verse.verse == verse,
        )
    ).first()

    if not verse_obj:
        raise HTTPException(status_code=404, detail="Verse not found")

    backlinks: List[BacklinkRead] = []

    refs = session.exec(
        select(NoteCrossReference, Note, User)
        .join(Note, Note.id == NoteCrossReference.note_id)
        .join(User, User.id == Note.owner_id)
        .where(NoteCrossReference.target_verse_id == verse_obj.id)
    ).all()

    for cross_ref, note, owner in refs:
        if not note.is_public and (not current_user or note.owner_id != current_user.id):
            continue
        backlinks.append(
            BacklinkRead(
                note_id=note.id,
                note_title=note.title,
                note_owner_name=owner.display_name or owner.email,
                note_owner_id=owner.id,
                note_is_public=note.is_public,
            )
        )

    return BacklinksResponse(backlinks=backlinks)
