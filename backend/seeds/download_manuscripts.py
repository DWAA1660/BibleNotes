import argparse
import json
import logging
import re
from pathlib import Path
from typing import Dict, List, Tuple

import httpx

BYZTXT_BASE = "https://api.github.com/repos/byztxt/{repo}/contents/textonly"
BYZTXT_RAW = "https://raw.githubusercontent.com/byztxt/{repo}/master/textonly/{path}"
OSHB_WLC_LIST = "https://api.github.com/repos/openscriptures/morphhb/contents/wlc"

logger = logging.getLogger(__name__)


def configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(levelname)s %(message)s",
    )


def fetch_json(url: str) -> List[Dict]:
    with httpx.Client(timeout=30) as client:
        r = client.get(url, headers={"Accept": "application/vnd.github.v3+json"})
        r.raise_for_status()
        return r.json()


def fetch_text(url: str) -> str:
    with httpx.Client(timeout=60) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.text

def fetch_bytes(url: str) -> bytes:
    with httpx.Client(timeout=60) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.content


def parse_titles_wh(text: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = re.split(r"\s+", line, maxsplit=1)
        if len(parts) == 2:
            code, title = parts
            mapping[code.strip()] = title.strip()
    return mapping


def parse_titles_scv(text: str) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        parts = re.split(r"\s+", line, maxsplit=1)
        if len(parts) == 2:
            code, title = parts
            mapping[code.strip()] = title.strip()
    return mapping


VERSE_START = re.compile(r"^\s*(\d+):(\d+)\s+(.*)$")


def parse_textonly_book(text: str) -> Dict[str, Dict[str, str]]:
    chapters: Dict[str, Dict[str, str]] = {}
    cur_ch: str | None = None
    cur_vs: str | None = None
    cur_buf: List[str] = []

    def flush() -> None:
        nonlocal cur_ch, cur_vs, cur_buf
        if cur_ch is not None and cur_vs is not None:
            chapters.setdefault(cur_ch, {})[cur_vs] = " ".join(s.strip() for s in cur_buf).strip()
        cur_ch, cur_vs, cur_buf = None, None, []

    for raw in text.splitlines():
        m = VERSE_START.match(raw)
        if m:
            flush()
            ch, vs, rest = m.group(1), m.group(2), m.group(3)
            cur_ch, cur_vs = ch, vs
            cur_buf = [rest]
        else:
            if raw.strip():
                cur_buf.append(raw.strip())
    flush()
    return chapters

# ---------------- OSHB (WLC OSIS) ----------------
import xml.etree.ElementTree as ET

OSIS_NS = {"osis": "http://www.bibletechnologies.net/2003/OSIS/namespace"}

def osis_extract_ref(osis_id: str) -> Tuple[str, int, int]:
    # Example: Gen.1.1 or Gen.1.1!a
    parts = osis_id.split(".")
    if len(parts) < 3:
        raise ValueError(f"Unexpected osisID: {osis_id}")
    book = parts[0]
    chap = int(parts[1])
    vs_part = parts[2]
    vs = int(vs_part.split("!")[0])
    return book, chap, vs

def normalize_book_alias(name: str) -> str:
    # Minimal mapping to app canonical names; rest handled by normalize on seed
    mapping = {
        "Gen": "Genesis",
        "Exod": "Exodus",
        "Lev": "Leviticus",
        "Num": "Numbers",
        "Deut": "Deuteronomy",
        "Josh": "Joshua",
        "Judg": "Judges",
        "Ruth": "Ruth",
        "1Sam": "1 Samuel",
        "2Sam": "2 Samuel",
        "1Kgs": "1 Kings",
        "2Kgs": "2 Kings",
        "1Chr": "1 Chronicles",
        "2Chr": "2 Chronicles",
        "Ezra": "Ezra",
        "Neh": "Nehemiah",
        "Esth": "Esther",
        "Job": "Job",
        "Ps": "Psalms",
        "Prov": "Proverbs",
        "Eccl": "Ecclesiastes",
        "Song": "Song of Solomon",
        "Isa": "Isaiah",
        "Jer": "Jeremiah",
        "Lam": "Lamentations",
        "Ezek": "Ezekiel",
        "Dan": "Daniel",
        "Hos": "Hosea",
        "Joel": "Joel",
        "Amos": "Amos",
        "Obad": "Obadiah",
        "Jonah": "Jonah",
        "Mic": "Micah",
        "Nah": "Nahum",
        "Hab": "Habakkuk",
        "Zeph": "Zephaniah",
        "Hag": "Haggai",
        "Zech": "Zechariah",
        "Mal": "Malachi",
    }
    return mapping.get(name, name)

def parse_osis_book(xml_bytes: bytes) -> Tuple[str, Dict[str, Dict[str, str]]]:
    root = ET.fromstring(xml_bytes)
    verses = root.findall('.//osis:verse', OSIS_NS)
    book_name = None
    chapters: Dict[str, Dict[str, str]] = {}
    for v in verses:
        osis_id = v.attrib.get('osisID') or v.attrib.get('{http://www.bibletechnologies.net/2003/OSIS/namespace}osisID')
        if not osis_id:
            # Sometimes verse may declare 'sID'/'eID' pairs; skip markers
            continue
        b, ch, vs = osis_extract_ref(osis_id)
        if book_name is None:
            book_name = normalize_book_alias(b)
        text = ''.join(v.itertext()).strip()
        # collapse whitespace
        text = re.sub(r"\s+", " ", text)
        chapters.setdefault(str(ch), {})[str(vs)] = text
    if book_name is None:
        raise ValueError("No verses found in OSIS file")
    return book_name, chapters

def download_oshb(out_root: Path) -> Tuple[str, Path]:
    items = fetch_json(OSHB_WLC_LIST)
    # filter only OSIS book files
    xml_items = [it for it in items if it.get('name', '').endswith('.xml') and it.get('name') != 'VerseMap.xml']
    code = "OSHB"
    out_dir = out_root / code
    ensure_dir(out_dir)
    data: Dict[str, Dict[str, Dict[str, str]]] = {}
    for it in xml_items:
        url = it.get('download_url')
        if not url:
            # fallback to raw URL
            url = f"https://raw.githubusercontent.com/openscriptures/morphhb/master/{it['path']}"
        xml_bytes = fetch_bytes(url)
        book_name, chapters = parse_osis_book(xml_bytes)
        data[book_name] = chapters
    write_json(out_dir / f"{code}.json", data)
    meta = {
        "name": "Open Scriptures Hebrew Bible (WLC OSIS)",
        "language": "heb",
        "scope": "OT",
        "license_name": "CC BY 4.0",
        "license_url": "https://creativecommons.org/licenses/by/4.0/",
        "source_url": "https://github.com/openscriptures/morphhb",
        "description": "OSHB OSIS files based on WLC with morphology; text-only extracted.",
    }
    write_json(out_dir / f"{code}_meta.json", meta)
    return code, out_dir


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, obj) -> None:
    with path.open("w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


def download_wh(out_root: Path) -> Tuple[str, Path]:
    repo = "greektext-westcott-hort"
    items = fetch_json(BYZTXT_BASE.format(repo=repo))
    titles_txt = fetch_text(BYZTXT_RAW.format(repo=repo, path="TITLES.W-H"))
    titles = parse_titles_wh(titles_txt)

    code = "WH"
    out_dir = out_root / code
    ensure_dir(out_dir)
    data: Dict[str, Dict[str, Dict[str, str]]] = {}

    for it in items:
        name = it.get("name")
        if not name or not name.endswith(".WH"):
            continue
        book_code = name[:-3]
        book_name = titles.get(book_code, book_code)
        txt = fetch_text(BYZTXT_RAW.format(repo=repo, path=name))
        chapters = parse_textonly_book(txt)
        data[book_name] = chapters

    write_json(out_dir / f"{code}.json", data)
    meta = {
        "name": "Westcott–Hort Greek New Testament (text-only)",
        "language": "grc",
        "scope": "NT",
        "license_name": "Public Domain",
        "license_url": "https://github.com/byztxt/greektext-westcott-hort#readme",
        "source_url": "https://github.com/byztxt/greektext-westcott-hort",
        "description": "Text-only Westcott–Hort with no punctuation/accents.",
    }
    write_json(out_dir / f"{code}_meta.json", meta)
    return code, out_dir


def download_scv(out_root: Path) -> Tuple[str, Path]:
    repo = "greektext-scrivener"
    items = fetch_json(BYZTXT_BASE.format(repo=repo))
    titles_txt = fetch_text(BYZTXT_RAW.format(repo=repo, path="TITLES.SCV"))
    titles = parse_titles_scv(titles_txt)

    code = "SCV"
    out_dir = out_root / code
    ensure_dir(out_dir)
    data: Dict[str, Dict[str, Dict[str, str]]] = {}

    for it in items:
        name = it.get("name")
        if not name or not name.endswith(".SCV"):
            continue
        book_code = name[:-4]
        book_name = titles.get(book_code, book_code)
        txt = fetch_text(BYZTXT_RAW.format(repo=repo, path=name))
        chapters = parse_textonly_book(txt)
        data[book_name] = chapters

    write_json(out_dir / f"{code}.json", data)
    meta = {
        "name": "Scrivener 1894 Textus Receptus (text-only)",
        "language": "grc",
        "scope": "NT",
        "license_name": "Public Domain",
        "license_url": "https://github.com/byztxt/greektext-scrivener#readme",
        "source_url": "https://github.com/byztxt/greektext-scrivener",
        "description": "Text-only Scrivener TR 1894.",
    }
    write_json(out_dir / f"{code}_meta.json", meta)
    return code, out_dir


def main() -> None:
    parser = argparse.ArgumentParser(description="Download manuscript editions into manuscripts/ assets")
    parser.add_argument("--out", type=Path, default=Path("manuscripts"))
    parser.add_argument("--wh", action="store_true")
    parser.add_argument("--scv", action="store_true")
    parser.add_argument("--oshb", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    configure_logging(args.verbose)

    out_root = args.out.resolve()
    ensure_dir(out_root)

    targets: List[str] = []
    if args.all or (not args.wh and not args.scv and not args.oshb):
        targets = ["wh", "scv", "oshb"]
    else:
        if args.wh:
            targets.append("wh")
        if args.scv:
            targets.append("scv")
        if args.oshb:
            targets.append("oshb")

    completed: List[str] = []
    for t in targets:
        if t == "wh":
            code, _ = download_wh(out_root)
            completed.append(code)
        elif t == "scv":
            code, _ = download_scv(out_root)
            completed.append(code)
        elif t == "oshb":
            code, _ = download_oshb(out_root)
            completed.append(code)

    logger.info("Downloaded editions: %s", ", ".join(completed))


if __name__ == "__main__":
    main()
