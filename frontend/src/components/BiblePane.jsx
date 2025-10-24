import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

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
  const [topSpacerHeight, setTopSpacerHeight] = useState(0);
  const baseTopOffsetRef = useRef(0);
  const lastBroadcastRef = useRef({ top: -1, hash: "" });
  const stabilizingRef = useRef(false);
  const pendingSpacerRef = useRef(null);
 

  // Measure Bible verse heights and broadcast to Manuscripts for equalization
  // - We measure each verse div's natural height (without minHeight)
  // - We compute our base top offset relative to the scroll container
  // - We emit heights and baseTop so Manuscripts can align via a top spacer
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

  // Stabilize on chapter/book switch while both panes measure and exchange
  useEffect(() => {
    if (activeTab !== 'manuscripts' || !chapterData) return;
    stabilizingRef.current = true;
    pendingSpacerRef.current = null;
    lastBroadcastRef.current = { top: -1, hash: "" };
    const t = setTimeout(() => {
      stabilizingRef.current = false;
      if (pendingSpacerRef.current != null) {
        const desired = pendingSpacerRef.current;
        setTopSpacerHeight(prev => (Math.abs(prev - desired) > 1 ? desired : prev));
      }
      pendingSpacerRef.current = null;
    }, 250);
    return () => clearTimeout(t);
  }, [activeTab, chapterData?.book, chapterData?.chapter]);

  // Measure Bible verse heights and broadcast to Manuscripts for equalization
  useEffect(() => {
    if (activeTab !== 'manuscripts') return;
    function measureAndEmit() {
      const list = listRef.current;
      const container = contentRef.current;
      if (!list || !container || !chapterData) return;
      const items = Array.from(list.querySelectorAll('[data-verse]'));
      const heights = {};
      for (const el of items) {
        const v = Number(el.getAttribute('data-verse'));
        const prevMinHeight = el.style.minHeight;
        if (prevMinHeight) el.style.minHeight = '';
        const rect = el.getBoundingClientRect().height;
        if (prevMinHeight) el.style.minHeight = prevMinHeight;
        if (v) heights[v] = rect;
      }
      // Base offset excludes any spacer we apply for alignment
      const rawTop = Math.max(0, list.getBoundingClientRect().top - container.getBoundingClientRect().top);
      const baseTop = Math.max(0, rawTop - topSpacerHeight);
      baseTopOffsetRef.current = baseTop;
      // Emit only if changed enough to matter
      const heightsKey = Object.keys(heights).sort().map(k => `${k}:${Math.round(heights[k])}`).join('|');
      const last = lastBroadcastRef.current;
      const topChanged = Math.abs((last.top ?? -1) - baseTop) > 1;
      const heightsChanged = heightsKey !== last.hash;
      if (topChanged || heightsChanged) {
        lastBroadcastRef.current = { top: baseTop, hash: heightsKey };
        try {
          window.dispatchEvent(new CustomEvent('bible-verse-heights', { detail: { book: chapterData.book, chapter: chapterData.chapter, heights, topOffset: baseTop } }));
        } catch {}
      }
    }
    const rAF = () => requestAnimationFrame(() => { measureAndEmit(); setTimeout(measureAndEmit, 0); });
    rAF();
    window.addEventListener('resize', rAF);
    return () => window.removeEventListener('resize', rAF);
  }, [activeTab, chapterData, selectedVerseId, topSpacerHeight]);

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
        try {
          window.dispatchEvent(new CustomEvent("bible-verse-selected", { detail: { book: chapterData.book, chapter: chapterData.chapter, verse: d.verse } }));
        } catch {}
      }
    }
    window.addEventListener("goto-verse", onGoto);
    return () => window.removeEventListener("goto-verse", onGoto);
  }, [chapterData]);

  // Apply min-heights from Manuscripts pane to align rows vertically
  useEffect(() => {
    function applyHeights(map) {
      const list = listRef.current;
      if (!list) return;
      const items = Array.from(list.querySelectorAll('[data-verse]'));
      for (const el of items) {
        const v = Number(el.getAttribute('data-verse'));
        const h = map[v];
        if (activeTab === 'manuscripts' && h) {
          el.style.minHeight = `${Math.ceil(h)}px`;
        } else {
          el.style.minHeight = '';
        }
      }
    }

    // Apply min-heights from Manuscripts pane to align rows vertically
    function onHeights(e) {
      const d = e.detail || {};
      if (!chapterData) return;
      if (d.book !== chapterData.book || d.chapter !== chapterData.chapter) return;
      applyHeights(d.heights || {});
      // Compute the spacer we need so our effective top matches Manuscripts' base top
      const msBase = Number(d.topOffset) || 0;
      const myBase = baseTopOffsetRef.current || 0;
      const desired = Math.max(0, Math.ceil(msBase - myBase));
      if (stabilizingRef.current) {
        pendingSpacerRef.current = desired;
        return;
      }
      setTopSpacerHeight(prev => {
        if (activeTab !== 'manuscripts') return 0;
        return Math.abs(prev - desired) > 1 ? desired : prev;
      });
    }

    window.addEventListener('manuscripts-verse-heights', onHeights);
    // Clear heights when switching away from manuscripts tab or changing chapter
    return () => {
      window.removeEventListener('manuscripts-verse-heights', onHeights);
      const list = listRef.current;
      if (list) {
        const items = Array.from(list.querySelectorAll('[data-verse]'));
        for (const el of items) el.style.minHeight = '';
      }
      setTopSpacerHeight(0);
    };
  }, [activeTab, chapterData]);

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
          <div className="verse-list" ref={listRef} style={{ marginTop: activeTab === 'manuscripts' ? `${topSpacerHeight}px` : undefined }}>
            {chapterData.verses.map(verse => (
              <div
                key={verse.id}
                className={`verse-item${verse.id === selectedVerseId ? " active" : ""}`}
                data-verse={verse.verse}
                onClick={() => {
                  onSelectVerse(verse.id, verse.verse);
                  try {
                    window.dispatchEvent(new CustomEvent("bible-verse-selected", { detail: { book: chapterData.book, chapter: chapterData.chapter, verse: verse.verse } }));
                  } catch {}
                }}
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
  isLoading: PropTypes.bool.isRequired,
  selectionMode: PropTypes.oneOf(["verse", "word"]).isRequired,
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
