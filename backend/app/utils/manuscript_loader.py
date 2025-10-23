import json
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

from ..config import get_settings

settings = get_settings()


class ManuscriptLoader:
    def __init__(self, assets_dir: Path | None = None):
        self.assets_dir = assets_dir or settings.manuscript_assets_path

    def list_editions(self) -> List[str]:
        editions: List[str] = []
        if not self.assets_dir.exists():
            return editions
        for p in self.assets_dir.iterdir():
            if not p.is_dir():
                continue
            code = p.name
            data = p / f"{code}.json"
            if data.exists():
                editions.append(code)
        return sorted(editions)

    def load_meta(self, edition_code: str) -> Dict[str, str]:
        edition_dir = self.assets_dir / edition_code
        meta_path = edition_dir / f"{edition_code}_meta.json"
        meta: Dict[str, str] = {}
        if meta_path.exists():
            with meta_path.open("r", encoding="utf-8") as f:
                meta = json.load(f)
        return meta

    def load_edition(self, edition_code: str) -> Dict[str, Dict[str, Dict[str, str]]]:
        edition_dir = self.assets_dir / edition_code
        data_path = edition_dir / f"{edition_code}.json"
        if not data_path.exists():
            raise FileNotFoundError(f"Manuscript JSON not found for edition {edition_code}")
        with data_path.open("r", encoding="utf-8") as f:
            return json.load(f)

    def iter_verses(self, edition_code: str) -> Iterable[Tuple[str, int, int, str, str]]:
        data = self.load_edition(edition_code)
        for book, chapters in data.items():
            for chapter_str, verses in chapters.items():
                chapter = int(chapter_str)
                for verse_str, text in verses.items():
                    verse = int(verse_str)
                    canonical_id = f"{book}|{chapter}|{verse}"
                    yield book, chapter, verse, canonical_id, text

    def list_books(self, edition_code: str) -> List[str]:
        data = self.load_edition(edition_code)
        return sorted(data.keys())
