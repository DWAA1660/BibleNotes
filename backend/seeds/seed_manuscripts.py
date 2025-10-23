import argparse
import logging
import sys
from pathlib import Path
from typing import Iterable, List, Optional

from sqlmodel import Session, SQLModel, create_engine, delete, select

try:
    from backend.app.models import ManuscriptBookCoverage, ManuscriptEdition, ManuscriptVerse
    from backend.app.utils.manuscript_loader import ManuscriptLoader
    from backend.app.utils.reference_parser import normalize_book
except ModuleNotFoundError:
    ROOT_DIR = Path(__file__).resolve().parents[2]
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    from backend.app.models import ManuscriptBookCoverage, ManuscriptEdition, ManuscriptVerse
    from backend.app.utils.manuscript_loader import ManuscriptLoader
    from backend.app.utils.reference_parser import normalize_book


logger = logging.getLogger(__name__)


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )


def resolve_editions(loader: ManuscriptLoader, requested_edition: Optional[str], seed_all: bool) -> List[str]:
    available = loader.list_editions()
    if seed_all:
        if not available:
            raise SystemExit("No manuscript editions found in assets directory")
        return sorted(available)
    if not requested_edition:
        raise SystemExit("Either --edition or --all must be provided")
    if requested_edition not in available:
        raise SystemExit(
            f"Manuscript edition '{requested_edition}' not found. Available editions: {', '.join(sorted(available))}"
        )
    return [requested_edition]


def ensure_edition_record(
    session: Session,
    edition_code: str,
    *,
    name: Optional[str],
    language: Optional[str],
    scope: Optional[str],
    license_name: Optional[str],
    license_url: Optional[str],
    source_url: Optional[str],
    description: Optional[str],
) -> ManuscriptEdition:
    edition = session.get(ManuscriptEdition, edition_code)
    if edition is None:
        edition = ManuscriptEdition(
            code=edition_code,
            name=name or edition_code,
            language=language or "",
            scope=scope or "",
            license_name=license_name,
            license_url=license_url,
            source_url=source_url,
            description=description,
        )
        session.add(edition)
    else:
        updated = False
        if name and edition.name != name:
            edition.name = name
            updated = True
        if language and edition.language != language:
            edition.language = language
            updated = True
        if scope and edition.scope != scope:
            edition.scope = scope
            updated = True
        if license_name is not None and edition.license_name != license_name:
            edition.license_name = license_name
            updated = True
        if license_url is not None and edition.license_url != license_url:
            edition.license_url = license_url
            updated = True
        if source_url is not None and edition.source_url != source_url:
            edition.source_url = source_url
            updated = True
        if description is not None and edition.description != description:
            edition.description = description
            updated = True
        if updated:
            session.add(edition)
    session.commit()
    session.refresh(edition)
    return edition


def has_existing_verses(session: Session, edition_code: str) -> bool:
    existing = session.exec(
        select(ManuscriptVerse.id).where(ManuscriptVerse.edition_code == edition_code).limit(1)
    ).first()
    return existing is not None


def delete_existing_data(session: Session, edition_code: str) -> None:
    session.exec(delete(ManuscriptVerse).where(ManuscriptVerse.edition_code == edition_code))
    session.exec(delete(ManuscriptBookCoverage).where(ManuscriptBookCoverage.edition_code == edition_code))
    session.commit()
    logger.info("Cleared existing manuscript data for %s", edition_code)


def build_verse_objects(loader: ManuscriptLoader, edition_code: str) -> Iterable[ManuscriptVerse]:
    for book, chapter, verse_num, canonical_id, text in loader.iter_verses(edition_code):
        book = normalize_book(book)
        yield ManuscriptVerse(
            edition_code=edition_code,
            book=book,
            chapter=chapter,
            verse=verse_num,
            canonical_id=canonical_id,
            text=text,
        )


def batch(session: Session, iterable, size: int = 1000) -> int:
    inserted = 0
    buffer: List = []
    for item in iterable:
        buffer.append(item)
        if len(buffer) >= size:
            session.add_all(buffer)
            session.commit()
            inserted += len(buffer)
            buffer.clear()
    if buffer:
        session.add_all(buffer)
        session.commit()
        inserted += len(buffer)
    return inserted


def seed_edition(
    session: Session,
    loader: ManuscriptLoader,
    edition_code: str,
    *,
    force: bool,
) -> int:
    meta = loader.load_meta(edition_code)
    edition = ensure_edition_record(
        session,
        edition_code,
        name=meta.get("name"),
        language=meta.get("language"),
        scope=meta.get("scope"),
        license_name=meta.get("license_name"),
        license_url=meta.get("license_url"),
        source_url=meta.get("source_url"),
        description=meta.get("description"),
    )

    if has_existing_verses(session, edition_code):
        if not force:
            logger.info("Skipping %s - verses already seeded (use --force to overwrite)", edition_code)
            return 0
        delete_existing_data(session, edition_code)

    data = loader.load_edition(edition_code)
    books = sorted({normalize_book(b) for b in data.keys()})
    batch(
        session,
        (ManuscriptBookCoverage(edition_code=edition.code, book=b) for b in books),
        size=200,
    )
    total = batch(session, build_verse_objects(loader, edition_code))
    logger.info("Seeded %s verses for %s", total, edition_code)
    return total


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed manuscript data into the SQLite database")
    parser.add_argument("--db", type=Path, default=Path("backend/bible_notes.db"), help="Path to SQLite database")
    parser.add_argument("--edition", help="Specific manuscript edition code to seed")
    parser.add_argument("--all", action="store_true", help="Seed every manuscript edition found in assets directory")
    parser.add_argument("--assets-dir", type=Path, help="Override the default manuscript assets directory")
    parser.add_argument("--force", action="store_true", help="Overwrite existing data for the edition")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    configure_logging(args.verbose)

    db_path = args.db.resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    assets_dir = args.assets_dir.resolve() if args.assets_dir else None
    loader = ManuscriptLoader(assets_dir)

    editions = resolve_editions(loader, args.edition, args.all)

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        total_inserted = 0
        for edition_code in editions:
            inserted = seed_edition(
                session,
                loader,
                edition_code,
                force=args.force,
            )
            total_inserted += inserted
    logger.info("Completed seeding. %s verses inserted across %s edition(s).", total_inserted, len(editions))


if __name__ == "__main__":
    main()
