from markdown_it import MarkdownIt
from bleach import clean
import re
from .reference_parser import REFERENCE_REGEX, PAREN_CONTENT

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

        # Replace each scripture reference inside with an anchor
        def repl_ref(rm: re.Match) -> str:
            book = rm.group('book')
            chapter = rm.group('chapter')
            verse = rm.group('verse')
            endv = rm.group('endverse')
            text = rm.group(0)
            title = f"{book} {chapter}:{verse}" if verse else f"{book} {chapter}"
            if endv:
                title = f"{book} {chapter}:{verse}-{endv}"
            # Use rel="ref" and title to carry the reference; href is a no-op
            return f"<a href=\"#\" rel=\"ref\" title=\"{title}\">{text}</a>"

        linked = REFERENCE_REGEX.sub(repl_ref, inner)
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
