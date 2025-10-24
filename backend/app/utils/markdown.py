from markdown_it import MarkdownIt
from bleach import clean
import re
from .reference_parser import PAREN_CONTENT, tokenize_reference_text

md = MarkdownIt("commonmark")


def _linkify_parenthetical_refs(raw: str) -> str:
    """Wrap scripture refs inside parentheses with clickable anchors.
    Example: "(Romans 1:1-3, John 3:16)" => links for each reference.
    """
    if not raw:
        return raw

    def repl_paren(m: re.Match) -> str:
        inner = m.group(1)
        if not inner:
            return m.group(0)

        pieces = []
        for text, ref in tokenize_reference_text(inner):
            if not ref:
                pieces.append(text)
                continue

            verse_part = None
            if ref.has_explicit_verse:
                verse_part = (
                    f"{ref.verse_start}"
                    if ref.verse_start == ref.verse_end
                    else f"{ref.verse_start}-{ref.verse_end}"
                )
            title = f"{ref.book} {ref.chapter}:{verse_part}" if verse_part else f"{ref.book} {ref.chapter}"
            pieces.append(f"<a href=\"#\" rel=\"ref\" title=\"{title}\">{text}</a>")

        linked = "".join(pieces)
        return f"({linked})"

    return PAREN_CONTENT.sub(repl_paren, raw)


def render_markdown(text: str) -> str:
    html = md.render(text)
    html = _linkify_parenthetical_refs(html)
    return clean(html, tags=[
        "p",
        "ul",
        "ol",
        "li",
        "strong",
        "em",
        "blockquote",
        "code",
        "pre",
        "a",
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "span",
        "br",
    ], attributes={"a": ["href", "title", "rel", "target"]}, strip=True)
