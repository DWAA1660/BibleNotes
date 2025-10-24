import re
from dataclasses import dataclass
from typing import Iterable, List, Optional, Tuple

BOOK_ALIASES = {
    "gen": "Genesis",
    "ge": "Genesis",
    "gn": "Genesis",
    "ex": "Exodus",
    "exo": "Exodus",
    "lev": "Leviticus",
    "le": "Leviticus",
    "num": "Numbers",
    "nu": "Numbers",
    "deut": "Deuteronomy",
    "dt": "Deuteronomy",
    "josh": "Joshua",
    "jos": "Joshua",
    "judg": "Judges",
    "jg": "Judges",
    "rut": "Ruth",
    "ru": "Ruth",
    "1sam": "1 Samuel",
    "2sam": "2 Samuel",
    "1kgs": "1 Kings",
    "2kgs": "2 Kings",
    "1chr": "1 Chronicles",
    "2chr": "2 Chronicles",
    "ezra": "Ezra",
    "neh": "Nehemiah",
    "est": "Esther",
    "job": "Job",
    "ps": "Psalms",
    "psa": "Psalms",
    "psm": "Psalms",
    "pss": "Psalms",
    "pr": "Proverbs",
    "pro": "Proverbs",
    "ecc": "Ecclesiastes",
    "song": "Song of Solomon",
    "sos": "Song of Solomon",
    "isa": "Isaiah",
    "jer": "Jeremiah",
    "lam": "Lamentations",
    "eze": "Ezekiel",
    "dan": "Daniel",
    "hos": "Hosea",
    "joel": "Joel",
    "amos": "Amos",
    "obad": "Obadiah",
    "jon": "Jonah",
    "mic": "Micah",
    "nah": "Nahum",
    "hab": "Habakkuk",
    "zeph": "Zephaniah",
    "hag": "Haggai",
    "zech": "Zechariah",
    "mal": "Malachi",
    "mt": "Matthew",
    "mk": "Mark",
    "mr": "Mark",
    "lk": "Luke",
    "lu": "Luke",
    "jn": "John",
    "joh": "John",
    "acts": "Acts",
    "ac": "Acts",
    "rom": "Romans",
    "ro": "Romans",
    "1cor": "1 Corinthians",
    "2cor": "2 Corinthians",
    "1co": "1 Corinthians",
    "2co": "2 Corinthians",
    "gal": "Galatians",
    "ga": "Galatians",
    "eph": "Ephesians",
    "php": "Philippians",
    "phil": "Philippians",
    "col": "Colossians",
    "1th": "1 Thessalonians",
    "2th": "2 Thessalonians",
    "1tim": "1 Timothy",
    "2tim": "2 Timothy",
    "tit": "Titus",
    "phm": "Philemon",
    "heb": "Hebrews",
    "jas": "James",
    "1pet": "1 Peter",
    "2pet": "2 Peter",
    "1pe": "1 Peter",
    "2pe": "2 Peter",
    "1jn": "1 John",
    "2jn": "2 John",
    "3jn": "3 John",
    "1jo": "1 John",
    "2jo": "2 John",
    "3jo": "3 John",
    "jud": "Jude",
    "rev": "Revelation",
    "re": "Revelation",
}

# Matches a single scripture reference, e.g., "Romans 1:1-3" or "1 Cor 5:7"
REFERENCE_REGEX = re.compile(
    r"\b(?P<book>(?:[1-3]?\s?[A-Za-z]+)|(?:[1-3][A-Za-z]+)|(?:[A-Za-z]+))\s+(?P<chapter>\d+)(?::(?P<verse>\d+)(?:-(?P<endverse>\d+))?)?",
    re.IGNORECASE,
)
CHAPTER_VERSE_REGEX = re.compile(r"(?P<chapter>\d+):(?P<verse>\d+)(?:-(?P<endverse>\d+))?", re.IGNORECASE)
VERSE_ONLY_REGEX = re.compile(r"(?P<verse>\d+)(?:-(?P<endverse>\d+))?")

# Extracts text inside parentheses; we only treat references in parentheses as backlinks
PAREN_CONTENT = re.compile(r"\(([^)]{0,1000})\)")


@dataclass
class VerseReference:
    book: str
    chapter: int
    verse_start: int
    verse_end: int
    has_explicit_verse: bool = True
    raw: str = ""

    def canonical_ids(self) -> Iterable[str]:
        for verse in range(self.verse_start, self.verse_end + 1):
            yield f"{self.book}|{self.chapter}|{verse}"


def normalize_book(name: str) -> str:
    key = name.lower().replace(" ", "")
    return BOOK_ALIASES.get(key, name.title())


def _append_reference(
    tokens: List[Tuple[str, Optional[VerseReference]]],
    text: str,
    book: str,
    chapter: int,
    verse_start: int,
    verse_end: int,
    has_explicit_verse: bool,
) -> None:
    tokens.append(
        (
            text,
            VerseReference(
                book=book,
                chapter=chapter,
                verse_start=verse_start,
                verse_end=verse_end,
                has_explicit_verse=has_explicit_verse,
                raw=text,
            ),
        )
    )


def tokenize_reference_text(inner: str) -> List[Tuple[str, Optional[VerseReference]]]:
    tokens: List[Tuple[str, Optional[VerseReference]]] = []
    if not inner:
        return tokens

    last_book: Optional[str] = None
    last_chapter: Optional[int] = None
    i = 0
    length = len(inner)

    while i < length:
        ch = inner[i]

        if ch.isspace():
            j = i + 1
            while j < length and inner[j].isspace():
                j += 1
            tokens.append((inner[i:j], None))
            i = j
            continue

        if ch in ",;":
            tokens.append((ch, None))
            i += 1
            continue

        if (
            inner[i : i + 3].lower() == "and"
            and (i + 3 == length or not inner[i + 3].isalpha())
            and (i == 0 or not inner[i - 1].isalpha())
        ):
            tokens.append((inner[i : i + 3], None))
            i += 3
            continue

        match = REFERENCE_REGEX.match(inner, i)
        if match:
            text = match.group(0)
            book_raw = match.group("book")
            chapter = int(match.group("chapter"))
            verse = match.group("verse")
            endverse = match.group("endverse")

            verse_start = int(verse) if verse else 1
            verse_end = int(endverse) if endverse else verse_start
            book = normalize_book(book_raw)
            _append_reference(
                tokens,
                text,
                book,
                chapter,
                verse_start,
                verse_end,
                has_explicit_verse=verse is not None,
            )
            last_book = book
            last_chapter = chapter
            i = match.end()
            continue

        match = CHAPTER_VERSE_REGEX.match(inner, i)
        if match and last_book:
            text = match.group(0)
            chapter = int(match.group("chapter"))
            verse_start = int(match.group("verse"))
            endverse = match.group("endverse")
            verse_end = int(endverse) if endverse else verse_start
            _append_reference(
                tokens,
                text,
                last_book,
                chapter,
                verse_start,
                verse_end,
                has_explicit_verse=True,
            )
            last_chapter = chapter
            i = match.end()
            continue

        match = VERSE_ONLY_REGEX.match(inner, i)
        if match and last_book and last_chapter:
            text = match.group(0)
            verse_start = int(match.group("verse"))
            endverse = match.group("endverse")
            verse_end = int(endverse) if endverse else verse_start
            _append_reference(
                tokens,
                text,
                last_book,
                last_chapter,
                verse_start,
                verse_end,
                has_explicit_verse=True,
            )
            i = match.end()
            continue

        tokens.append((ch, None))
        i += 1

    return tokens


def parse_references(text: str) -> List[VerseReference]:
    """Extract verse references appearing inside parentheses."""
    references: List[VerseReference] = []
    if not text:
        return references

    for paren in PAREN_CONTENT.finditer(text):
        inner = paren.group(1) or ""
        for _, ref in tokenize_reference_text(inner):
            if ref:
                references.append(ref)

    return references


def extract_canonical_ids(text: str) -> List[str]:
    ids: List[str] = []
    for reference in parse_references(text):
        ids.extend(reference.canonical_ids())
    return ids
