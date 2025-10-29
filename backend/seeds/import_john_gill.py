import argparse
import logging
import re
import sys
from pathlib import Path
from typing import Iterator, List, Optional, Tuple

from sqlmodel import Session, SQLModel, create_engine, select, delete

# Support running directly (python backend/seeds/import_john_gill.py)
try:
    from backend.app.auth import get_password_hash
    from backend.app.models import Note, NoteCrossReference, User, Verse
    from backend.app.utils.markdown import render_markdown
    from backend.app.utils.reference_parser import extract_canonical_ids
except ModuleNotFoundError:
    ROOT_DIR = Path(__file__).resolve().parents[2]
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    from backend.app.auth import get_password_hash
    from backend.app.models import Note, NoteCrossReference, User, Verse
    from backend.app.utils.markdown import render_markdown
    from backend.app.utils.reference_parser import extract_canonical_ids

logger = logging.getLogger(__name__)


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )


def read_pdf_text(path: Path) -> str:
    try:
        from pypdf import PdfReader
    except Exception as e:
        raise SystemExit(
            "pypdf is required. Please `pip install -r backend/requirements.txt` or `pip install pypdf`."
        ) from e

    reader = PdfReader(str(path))
    chunks: List[str] = []
    for page in reader.pages:
        try:
            text = page.extract_text() or ""
        except Exception:
            text = ""
        if text:
            # Normalize whitespace a bit; keep newlines to aid parsing
            text = text.replace("\r", "\n")
            chunks.append(text)
    return "\n".join(chunks)


ChapterEntry = Tuple[int, int, str]  # (chapter, verse, content)


def parse_john_gill_text(full_text: str, *, initial_chapter: Optional[int] = None) -> List[ChapterEntry]:
    lines = [ln.strip() for ln in full_text.splitlines()]
    chap_re = re.compile(r"^\s*CHAPTER\s+(\d+)\b", re.IGNORECASE)
    ver_re = re.compile(r"^\s*Ver\.\s*(\d+)\.", re.IGNORECASE)

    entries: List[ChapterEntry] = []
    current_chapter: Optional[int] = initial_chapter
    chapter_counter = max(0, (initial_chapter or 0))
    current_verse: Optional[int] = None
    buffer: List[str] = []

    def flush() -> None:
        nonlocal buffer, current_verse, current_chapter
        if current_chapter is None or current_verse is None:
            buffer.clear()
            return
        content = " ".join(s for s in buffer).strip()
        # Remove any repeated leading "Ver. N." markers in content
        content = re.sub(r"^\s*Ver\.\s*\d+\.\s*", "", content)
        if content:
            entries.append((current_chapter, current_verse, content))
        buffer.clear()

    for raw in lines:
        if not raw:
            # Keep paragraph breaks minimal; do not add empty lines to buffer
            continue
        m_ch = chap_re.match(raw)
        if m_ch:
            # New chapter header
            flush()
            try:
                current_chapter = int(m_ch.group(1))
                chapter_counter = current_chapter
            except ValueError:
                # ignore malformed header
                pass
            current_verse = None
            buffer.clear()
            continue

        m_v = ver_re.match(raw)
        if m_v:
            # Starting a new verse entry
            flush()
            v = int(m_v.group(1))
            if v == 1:
                # Fallback: if chapter header not found, infer chapter++ on verse 1
                if current_chapter is None:
                    chapter_counter += 1
                    current_chapter = chapter_counter
                else:
                    # If we didn't recently see a chapter header and we already have at least one verse,
                    # a new verse 1 likely indicates the next chapter.
                    if entries:
                        chapter_counter = (current_chapter or 0) + 1
                        current_chapter = chapter_counter
            current_verse = v
            # Add the rest of the line after the marker
            tail = raw[m_v.end():].strip()
            if tail:
                buffer.append(tail)
            continue

        # Regular content line for current verse
        if current_verse is not None:
            buffer.append(raw)
        else:
            # Not inside a verse yet; ignore prologue or non-matching content
            continue

    # Flush the last buffered entry
    flush()

    return entries


def ensure_user(session: Session, *, email: str, display_name: str, password: str) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    if user:
        if user.display_name != display_name:
            user.display_name = display_name
            session.add(user)
            session.commit()
            session.refresh(user)
        return user
    user = User(
        email=email,
        hashed_password=get_password_hash(password),
        display_name=display_name,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    logger.info("Created user %s (%s)", display_name, email)
    return user


def delete_existing_author_notes_for_book(session: Session, author_id: int, version_code: str, book: str) -> int:
    # Delete only notes for this author within the book for the given version
    to_delete = session.exec(
        select(Note.id)
        .join(Verse, Note.start_verse_id == Verse.id)
        .where(
            Note.owner_id == author_id,
            Note.version_code == version_code,
            Verse.book == book,
        )
    ).all()
    if not to_delete:
        return 0
    session.exec(delete(Note).where(Note.id.in_(to_delete)))
    session.commit()
    return len(to_delete)


def insert_entries(
    session: Session,
    *,
    user: User,
    version_code: str,
    book: str,
    entries: List[ChapterEntry],
    is_public: bool = True,
    tags_csv: str = "commentary,john gill",
) -> Tuple[int, int]:
    inserted = 0
    skipped = 0
    for chapter, verse_num, content in entries:
        verse = session.exec(
            select(Verse).where(
                Verse.version_code == version_code,
                Verse.book == book,
                Verse.chapter == chapter,
                Verse.verse == verse_num,
            )
        ).first()
        if not verse:
            logger.warning("Missing verse: %s %s %s:%s", version_code, book, chapter, verse_num)
            skipped += 1
            continue

        note = Note(
            owner_id=user.id,
            title=f"Ver. {verse_num}",
            content_markdown=content,
            content_html=render_markdown(content),
            version_code=version_code,
            start_verse_id=verse.id,
            end_verse_id=verse.id,
            is_public=is_public,
        )
        note.tags_text = tags_csv
        session.add(note)
        # Build backlinks based on references in parentheses within the content
        try:
            canonical_ids = list(dict.fromkeys(extract_canonical_ids(content)))
        except Exception:
            canonical_ids = []
        if canonical_ids:
            targets = session.exec(
                select(Verse).where(
                    Verse.version_code == version_code,
                    Verse.canonical_id.in_(canonical_ids),
                )
            ).all()
            target_map = {v.canonical_id: v for v in targets}
            for cid in canonical_ids:
                tgt = target_map.get(cid)
                if not tgt:
                    continue
                note.cross_references.append(
                    NoteCrossReference(canonical_id=cid, target_verse_id=tgt.id)
                )
        inserted += 1
        # Commit periodically to keep memory low
        if inserted % 200 == 0:
            session.commit()
    session.commit()
    return inserted, skipped


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Import John Gill commentary (Genesis) into verse-anchored notes")
    p.add_argument("--db", type=Path, default=Path("backend/bible_notes.db"), help="Path to SQLite database")
    p.add_argument("--input-dir", type=Path, default=Path("commentators/John_Gill"), help="Directory of John Gill PDFs")
    p.add_argument("--version", default="KJV", help="Bible version code to anchor notes (e.g., KJV)")
    p.add_argument("--book", default="Genesis", help="Book name (default: Genesis)")
    p.add_argument("--email", default="johngill@seedscript.com", help="Seed user email")
    p.add_argument("--display-name", default="JohnGill", help="Seed user display name")
    p.add_argument("--password", default="Password123", help="Seed user password")
    p.add_argument("--clear", action="store_true", help="Delete existing notes for this author/book/version before import")
    p.add_argument("--verbose", action="store_true", help="Verbose logging")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    configure_logging(args.verbose)

    db_path: Path = args.db.resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    # Collect PDFs
    input_dir: Path = args.input_dir.resolve()
    if not input_dir.exists():
        raise SystemExit(f"Input directory not found: {input_dir}")
    pdfs = sorted([p for p in input_dir.glob("*.pdf") if p.is_file()])
    if not pdfs:
        raise SystemExit(f"No PDFs found in {input_dir}")

    # For Genesis-only import, process all PDFs but force book from flag
    total_inserted = 0
    total_skipped = 0

    with Session(engine) as session:
        user = ensure_user(session, email=args.email, display_name=args.display_name, password=args.password)

        if args.clear:
            deleted = delete_existing_author_notes_for_book(session, user.id, args.version, args.book)
            if deleted:
                logger.info("Cleared %s existing notes for %s (%s, %s)", deleted, user.display_name, args.book, args.version)

        for pdf in pdfs:
            logger.info("Parsing %s", pdf.name)
            text = read_pdf_text(pdf)
            entries = parse_john_gill_text(text)
            if not entries:
                logger.warning("No verse entries parsed from %s", pdf.name)
                continue
            inserted, skipped = insert_entries(
                session,
                user=user,
                version_code=args.version,
                book=args.book,
                entries=entries,
                is_public=True,
            )
            total_inserted += inserted
            total_skipped += skipped
            logger.info("%s: inserted=%s skipped=%s", pdf.name, inserted, skipped)

    logger.info("Done. Inserted %s notes (%s skipped)", total_inserted, total_skipped)


if __name__ == "__main__":
    main()
