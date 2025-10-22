import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from ..config import get_settings

settings = get_settings()


class BibleLoader:
    def __init__(self, assets_dir: Path | None = None):
        self.assets_dir = assets_dir or settings.bible_assets_path

    def list_versions(self) -> List[str]:
        return [p.name for p in self.assets_dir.iterdir() if p.is_dir() and (p / f"{p.name}_bible.json").exists()]

    def load_version(self, version_code: str) -> Dict[str, Dict[str, Dict[str, str]]]:
        version_dir = self.assets_dir / version_code
        data_path = version_dir / f"{version_code}_bible.json"
        if not data_path.exists():
            raise FileNotFoundError(f"Bible JSON not found for version {version_code}")
        with data_path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def iter_verses(self, version_code: str) -> Iterable[Tuple[str, int, int, str, str]]:
        data = self.load_version(version_code)
        for book, chapters in data.items():
            for chapter_str, verses in chapters.items():
                chapter = int(chapter_str)
                for verse_str, text in verses.items():
                    verse = int(verse_str)
                    canonical_id = f"{book}|{chapter}|{verse}"
                    yield book, chapter, verse, canonical_id, text
