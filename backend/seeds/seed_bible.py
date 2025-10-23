import argparse
import logging
import sys
from pathlib import Path
from typing import Iterable, List, Optional

from sqlmodel import Session, SQLModel, create_engine, delete, select

try:
    from backend.app.models import BibleVersion, Verse
    from backend.app.utils.bible_loader import BibleLoader
except ModuleNotFoundError:
    ROOT_DIR = Path(__file__).resolve().parents[2]
    if str(ROOT_DIR) not in sys.path:
        sys.path.insert(0, str(ROOT_DIR))
    from backend.app.models import BibleVersion, Verse
    from backend.app.utils.bible_loader import BibleLoader


logger = logging.getLogger(__name__)


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )


def resolve_versions(loader: BibleLoader, requested_version: Optional[str], seed_all: bool) -> List[str]:
    available = loader.list_versions()
    if seed_all:
        if not available:
            raise SystemExit("No Bible versions found in assets directory")
        return sorted(available)

    if not requested_version:
        raise SystemExit("Either --version or --all must be provided")

    if requested_version not in available:
        raise SystemExit(
            f"Bible version '{requested_version}' not found. Available versions: {', '.join(sorted(available))}"
        )

    return [requested_version]


def ensure_version_record(
    session: Session,
    version_code: str,
    *,
    display_name: Optional[str],
    language: Optional[str],
    description: Optional[str],
) -> BibleVersion:
    version = session.get(BibleVersion, version_code)
    created = False
    if version is None:
        version = BibleVersion(
            code=version_code,
            name=display_name or version_code,
            language=language or "English",
            description=description,
        )
        session.add(version)
        created = True
    else:
        updated = False
        if display_name and version.name != display_name:
            version.name = display_name
            updated = True
        if language and version.language != language:
            version.language = language
            updated = True
        if description is not None and version.description != description:
            version.description = description
            updated = True
        if updated:
            session.add(version)
    if created:
        logger.info("Created `BibleVersion` record for %s", version_code)
    session.commit()
    session.refresh(version)
    return version


def has_existing_verses(session: Session, version_code: str) -> bool:
    existing = session.exec(select(Verse.id).where(Verse.version_code == version_code).limit(1)).first()
    return existing is not None


def delete_existing_verses(session: Session, version_code: str) -> None:
    session.exec(delete(Verse).where(Verse.version_code == version_code))
    session.commit()
    logger.info("Cleared existing verses for %s", version_code)


def batch(session: Session, iterable: Iterable[Verse], size: int = 1000) -> int:
    inserted = 0
    buffer: List[Verse] = []
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


def build_verse_objects(loader: BibleLoader, version_code: str) -> Iterable[Verse]:
    for book, chapter, verse_num, canonical_id, text in loader.iter_verses(version_code):
        yield Verse(
            version_code=version_code,
            book=book,
            chapter=chapter,
            verse=verse_num,
            canonical_id=canonical_id,
            text=text,
        )


def seed_version(
    session: Session,
    loader: BibleLoader,
    version_code: str,
    *,
    force: bool,
    display_name: Optional[str],
    language: Optional[str],
    description: Optional[str],
) -> int:
    ensure_version_record(
        session,
        version_code,
        display_name=display_name,
        language=language,
        description=description,
    )

    if has_existing_verses(session, version_code):
        if not force:
            logger.info("Skipping %s - verses already seeded (use --force to overwrite)", version_code)
            return 0
        delete_existing_verses(session, version_code)

    total = batch(session, build_verse_objects(loader, version_code))
    logger.info("Seeded %s verses for %s", total, version_code)
    return total


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed Bible data into the SQLite database")
    parser.add_argument("--db", type=Path, default=Path("backend/bible_notes.db"), help="Path to SQLite database")
    parser.add_argument("--version", help="Specific Bible version code to seed")
    parser.add_argument("--all", action="store_true", help="Seed every Bible version found in assets directory")
    parser.add_argument("--assets-dir", type=Path, help="Override the default Bible assets directory")
    parser.add_argument("--name", dest="name", help="Display name for the version (single version only)")
    parser.add_argument("--language", dest="language", help="Language for the version (defaults to English)")
    parser.add_argument("--description", dest="description", help="Description for the version record")
    parser.add_argument("--force", action="store_true", help="Overwrite existing verse data for the version")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    configure_logging(args.verbose)

    db_path = args.db.resolve()
    db_path.parent.mkdir(parents=True, exist_ok=True)

    assets_dir = args.assets_dir.resolve() if args.assets_dir else None
    loader = BibleLoader(assets_dir)

    versions = resolve_versions(loader, args.version, args.all)

    engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
    SQLModel.metadata.create_all(engine)

    with Session(engine) as session:
        total_inserted = 0
        for version_code in versions:
            inserted = seed_version(
                session,
                loader,
                version_code,
                force=args.force,
                display_name=args.name if len(versions) == 1 else None,
                language=args.language,
                description=args.description if len(versions) == 1 else args.description,
            )
            total_inserted += inserted
    logger.info("Completed seeding. %s verses inserted across %s version(s).", total_inserted, len(versions))


if __name__ == "__main__":
    main()
