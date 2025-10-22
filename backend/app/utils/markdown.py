from markdown_it import MarkdownIt
from bleach import clean

md = MarkdownIt("commonmark")


def render_markdown(text: str) -> str:
    html = md.render(text)
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
