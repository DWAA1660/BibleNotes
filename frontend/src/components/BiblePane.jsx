import PropTypes from "prop-types";
import { useEffect, useRef } from "react";

function BiblePane({ chapterData, selectedVerseId, onSelectVerse, isLoading, selectionMode, onSelectionModeChange, activeTab }) {
  const stripTags = html => html.replace(/<[^>]+>/g, " ");
  const tokenize = text => stripTags(text || "").trim().split(/\s+/).filter(Boolean);
  const STOPWORDS = new Set([
    "the","a","an","and","or","but","is","was","are","were","be","being","been",
    "that","which","who","whom","whose","of","for","to","in","on","at","with","by","from","as","into","unto","upon",
    "than","then","so","do","does","did","not","no","nor","also","even","shall","will","would","should","can","could","may","might","must","let",
    "have","has","had","if","because","therefore","thus","there","here","this","these","those",
    "he","she","it","we","you","they","him","her","them","his","hers","its","our","your","their","me","my","mine","yours","theirs","us"
  ]);

  const broadcastWordSelection = (verseObj, tokenIndex, tokenText) => {
    try {
      const tokens = tokenize(verseObj?.text || "");
      const nonStopIndices = [];
      for (let i = 0; i < tokens.length; i++) {
        const t = tokens[i].toLowerCase();
        if (!STOPWORDS.has(t)) nonStopIndices.push(i);
      }
      const nonStopIndex = nonStopIndices.indexOf(tokenIndex); // -1 if stopword
      const payload = {
        book: chapterData?.book,
        chapter: chapterData?.chapter,
        verse: verseObj?.verse,
        index: tokenIndex,
        token: tokenText,
        englishTokenCount: tokens.length,
        englishNonStopIndex: nonStopIndex,
        englishNonStopCount: nonStopIndices.length,
        clickedStopword: nonStopIndex === -1,
        mode: selectionMode
      };
      try { window.localStorage.setItem("lastWordSelectToken", tokenText); } catch {}
      window.localStorage.setItem("wordSelect", JSON.stringify(payload));
      window.dispatchEvent(new CustomEvent("word-select", { detail: payload }));
    } catch {}
  };
  const contentRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    function onSync(e) {
      if (activeTab !== "manuscripts") return;
      const d = e.detail || {};
      if (!chapterData || d.book !== chapterData.book || d.chapter !== chapterData.chapter) return;
      const container = contentRef.current;
      const list = listRef.current;
      if (!container || !list) return;
      const target = list.querySelector(`[data-verse="${d.verse}"]`);
      if (target) {
        const offset = target.offsetTop - list.offsetTop;
        container.scrollTo({ top: offset - 8, behavior: "smooth" });
      }
    }
    window.addEventListener("manuscripts-scroll-verse", onSync);
    return () => window.removeEventListener("manuscripts-scroll-verse", onSync);
  }, [activeTab, chapterData]);

  useEffect(() => {
    function onGoto(e) {
      const d = e.detail || {};
      if (!chapterData || d.book !== chapterData.book || d.chapter !== chapterData.chapter) return;
      const container = contentRef.current;
      const list = listRef.current;
      if (!container || !list) return;
      const target = list.querySelector(`[data-verse="${d.verse}"]`);
      if (target) {
        const offset = target.offsetTop - list.offsetTop;
        container.scrollTo({ top: Math.max(0, offset - 8), behavior: "smooth" });
        const num = target.querySelector('.verse-number');
        if (num) {
          num.classList.add('flash');
          setTimeout(() => num.classList.remove('flash'), 1200);
        }
      }
    }
    window.addEventListener("goto-verse", onGoto);
    return () => window.removeEventListener("goto-verse", onGoto);
  }, [chapterData]);

  return (
    <div className="pane">
      <div className="pane-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
        <div>Bible Text</div>
        <div className="segmented">
          <button
            type="button"
            className={selectionMode === "verse" ? "active" : ""}
            onClick={() => onSelectionModeChange("verse")}
          >
            Verse
          </button>
          <button
            type="button"
            className={selectionMode === "word" ? "active" : ""}
            onClick={() => onSelectionModeChange("word")}
          >
            Word
          </button>
        </div>
      </div>
      <div className="pane-content" ref={contentRef}>
        {isLoading ? (
          <div className="loading-state">Loading chapter...</div>
        ) : !chapterData ? (
          <div className="empty-state">Select a version, book, and chapter to begin.</div>
        ) : (
          <div className="verse-list" ref={listRef}>
            {chapterData.verses.map(verse => (
              <div
                key={verse.id}
                className={`verse-item${verse.id === selectedVerseId ? " active" : ""}`}
                data-verse={verse.verse}
                onClick={() => onSelectVerse(verse.id)}
              >
                <div>
                  <span className="verse-number">{verse.verse}</span>
                  {selectionMode === "word" ? (
                    <span>
                      {tokenize(verse.text).map((tok, i) => (
                        <span
                          key={i}
                          onClick={e => {
                            e.stopPropagation();
                            broadcastWordSelection(verse, i, tok);
                          }}
                        >
                          {tok}{" "}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span dangerouslySetInnerHTML={{ __html: verse.text }} />
                  )}
                </div>
                {verse.backlinks.length ? (
                  <div className="backlinks">
                    Backlinks: {verse.backlinks.length}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

BiblePane.propTypes = {
  chapterData: PropTypes.shape({
    verses: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        verse: PropTypes.number.isRequired,
        text: PropTypes.string.isRequired,
        backlinks: PropTypes.array.isRequired
      })
    )
  }),
  selectedVerseId: PropTypes.number,
  onSelectVerse: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  selectionMode: PropTypes.oneOf(["verse", "word"]),
  onSelectionModeChange: PropTypes.func,
  activeTab: PropTypes.string
};

BiblePane.defaultProps = {
  chapterData: null,
  selectedVerseId: null,
  isLoading: false,
  selectionMode: "verse",
  onSelectionModeChange: () => {},
  activeTab: "commentaries"
};

export default BiblePane;
