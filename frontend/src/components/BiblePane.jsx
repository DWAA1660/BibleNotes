import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

function BiblePane({ chapterData, selectedVerseId, onSelectVerse, isLoading, selectionMode, onSelectionModeChange, activeTab, onAddNote, syncNotes }) {
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
  const lastTopVerseRef = useRef(null);
  const notesHeightsRef = useRef({});
  const commHeightsRef = useRef({});
  const [heightsVersion, setHeightsVersion] = useState(0);
 

  // Measure Bible verse heights and broadcast to panes for equalization
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

  // Measure Bible verse heights and broadcast to Manuscripts/Sync Notes for equalization
  useEffect(() => {
    if (activeTab !== 'manuscripts' && !syncNotes) return;
    function measureAndEmit() {
      const list = listRef.current;
      const container = contentRef.current;
      if (!list || !container || !chapterData) return;
      const items = Array.from(list.querySelectorAll('[data-verse]'));
      const baseHeights = {};
      for (const el of items) {
        const v = Number(el.getAttribute('data-verse'));
        const prevMinHeight = el.style.minHeight;
        if (prevMinHeight) el.style.minHeight = '';
        const rect = el.getBoundingClientRect().height;
        if (prevMinHeight) el.style.minHeight = prevMinHeight;
        if (v) baseHeights[v] = rect;
      }
      // Base offset excludes any spacer we apply for alignment
      const rawTop = Math.max(0, list.getBoundingClientRect().top - container.getBoundingClientRect().top);
      const baseTop = Math.max(0, rawTop - topSpacerHeight);
      baseTopOffsetRef.current = baseTop;
      // Equalize with external pane heights when syncNotes
      const outHeights = {};
      const notesMap = syncNotes ? (notesHeightsRef.current || {}) : {};
      const commMap = syncNotes ? (commHeightsRef.current || {}) : {};
      for (const el of items) {
        const v = Number(el.getAttribute('data-verse'));
        if (!v) continue;
        const bi = baseHeights[v] || 0;
        const ni = notesMap[v] || 0;
        const ci = commMap[v] || 0;
        outHeights[v] = Math.max(bi, ni, ci);
      }
      // Apply fixed height to our own rows to equalize with other panes
      for (const el of items) {
        const v = Number(el.getAttribute('data-verse'));
        if (!v) continue;
        const h = outHeights[v] || 0;
        if ((activeTab === 'manuscripts' || syncNotes) && h) {
          el.style.minHeight = '';
          el.style.height = `${Math.ceil(h)}px`;
        } else if (!(activeTab === 'manuscripts' || syncNotes)) {
          el.style.minHeight = '';
          el.style.height = '';
        }
      }
      // Emit only if changed enough to matter
      const heightsKey = Object.keys(outHeights).sort().map(k => `${k}:${Math.round(outHeights[k])}`).join('|');
      const last = lastBroadcastRef.current;
      const topChanged = Math.abs((last.top ?? -1) - baseTop) > 1;
      const heightsChanged = heightsKey !== last.hash;
      if (topChanged || heightsChanged) {
        lastBroadcastRef.current = { top: baseTop, hash: heightsKey };
        try {
          window.dispatchEvent(new CustomEvent('bible-verse-heights', { detail: { book: chapterData.book, chapter: chapterData.chapter, heights: outHeights, topOffset: baseTop } }));
        } catch {}
      }
    }
    const rAF = () => requestAnimationFrame(() => { measureAndEmit(); setTimeout(measureAndEmit, 0); });
    rAF();
    window.addEventListener('resize', rAF);
    return () => window.removeEventListener('resize', rAF);
  }, [activeTab, chapterData, selectedVerseId, topSpacerHeight, syncNotes, heightsVersion]);

  // Listen for Notes/Commentary height measurements during Sync Notes
  useEffect(() => {
    if (!syncNotes || !chapterData) return;
    function onNotesHeights(e) {
      const d = e.detail || {};
      if (d.book !== chapterData.book || Number(d.chapter) !== Number(chapterData.chapter)) return;
      notesHeightsRef.current = d.heights || {};
      setHeightsVersion(v => v + 1);
    }
    function onCommHeights(e) {
      const d = e.detail || {};
      if (d.book !== chapterData.book || Number(d.chapter) !== Number(chapterData.chapter)) return;
      commHeightsRef.current = d.heights || {};
      setHeightsVersion(v => v + 1);
    }
    window.addEventListener('notes-verse-heights', onNotesHeights);
    window.addEventListener('commentary-verse-heights', onCommHeights);
    return () => {
      window.removeEventListener('notes-verse-heights', onNotesHeights);
      window.removeEventListener('commentary-verse-heights', onCommHeights);
      notesHeightsRef.current = {};
      commHeightsRef.current = {};
    };
  }, [syncNotes, chapterData?.book, chapterData?.chapter]);

  useEffect(() => {
    function onGoto(e) {
      const d = e.detail || {};
      if (!chapterData || d.book !== chapterData.book || d.chapter !== chapterData.chapter) return;

      const tryScroll = (attempt = 0) => {
        const container = contentRef.current;
        const list = listRef.current;
        if (!container || !list) {
          if (attempt < 12) {
            requestAnimationFrame(() => tryScroll(attempt + 1));
            setTimeout(() => tryScroll(attempt + 1), 40);
          }
          return;
        }
        const target = list.querySelector(`[data-verse="${d.verse}"]`);
        if (target) {
          // More robust: use scrollIntoView on the target inside the scrollable container
          target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
          const num = target.querySelector('.verse-number');
          if (num) {
            num.classList.add('flash');
            setTimeout(() => num.classList.remove('flash'), 1200);
          }
          try {
            window.dispatchEvent(new CustomEvent("bible-verse-selected", { detail: { book: chapterData.book, chapter: chapterData.chapter, verse: d.verse } }));
          } catch {}
          return;
        }
        if (attempt < 12) {
          // retry on next frame or after a tiny delay to wait for layout/paint
          requestAnimationFrame(() => tryScroll(attempt + 1));
          setTimeout(() => tryScroll(attempt + 1), 40);
        }
      };
      tryScroll(0);
    }
    window.addEventListener("goto-verse", onGoto);
    return () => window.removeEventListener("goto-verse", onGoto);
  }, [chapterData]);

  // As the Bible pane scrolls, emit the verse nearest the top so other panes can align
  useEffect(() => {
    const container = contentRef.current;
    if (!container || !chapterData) return;
    lastTopVerseRef.current = null;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        ticking = false;
        const list = listRef.current;
        if (!list) return;
        const items = Array.from(list.querySelectorAll('[data-verse]'));
        if (!items.length) return;
        const contRect = container.getBoundingClientRect();
        let bestVerse = null;
        let bestDelta = Infinity;
        for (const el of items) {
          const delta = el.getBoundingClientRect().top - contRect.top;
          if (delta >= -2 && delta < bestDelta) {
            bestDelta = delta;
            bestVerse = Number(el.getAttribute('data-verse')) || null;
          }
        }
        if (bestVerse == null) {
          // If all are below the top, choose the first; if all are above, choose the last
          const first = items[0];
          const last = items[items.length - 1];
          const firstDelta = first.getBoundingClientRect().top - contRect.top;
          const lastDelta = last.getBoundingClientRect().top - contRect.top;
          bestVerse = firstDelta >= 0 ? Number(first.getAttribute('data-verse')) : Number(last.getAttribute('data-verse'));
        }
        if (bestVerse && lastTopVerseRef.current !== bestVerse) {
          lastTopVerseRef.current = bestVerse;
          try {
            window.dispatchEvent(new CustomEvent('bible-verse-selected', { detail: { book: chapterData.book, chapter: chapterData.chapter, verse: bestVerse, source: "scroll" } }));
          } catch {}
        }
      });
    };
    container.addEventListener('scroll', onScroll);
    return () => container.removeEventListener('scroll', onScroll);
  }, [chapterData?.book, chapterData?.chapter]);

  // Fallback: whenever selectedVerseId changes, ensure the verse is scrolled into view
  useEffect(() => {
    if (!chapterData || !selectedVerseId) return;
    const found = chapterData.verses.find(v => v.id === selectedVerseId);
    if (!found) return;
    const container = contentRef.current;
    const list = listRef.current;
    if (!container || !list) return;

    const tryScroll = (attempt = 0) => {
      const target = list.querySelector(`[data-verse="${found.verse}"]`);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        const num = target.querySelector('.verse-number');
        if (num) {
          num.classList.add('flash');
          setTimeout(() => num.classList.remove('flash'), 1200);
        }
        return;
      }
      if (attempt < 12) {
        requestAnimationFrame(() => tryScroll(attempt + 1));
        setTimeout(() => tryScroll(attempt + 1), 40);
      }
    };
    tryScroll(0);
  }, [chapterData?.book, chapterData?.chapter, selectedVerseId]);

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
      <div className="pane-content top-gap" ref={contentRef}>
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
                    window.dispatchEvent(new CustomEvent("bible-verse-selected", { detail: { book: chapterData.book, chapter: chapterData.chapter, verse: verse.verse, source: "click" } }));
                  } catch {}
                }}
              >
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                  <span className="verse-number">{verse.verse}</span>
                  {onAddNote ? (
                    <button
                      type="button"
                      className="icon-btn add-note-btn"
                      title="Add note"
                      onClick={e => { e.stopPropagation(); onAddNote(chapterData.book, chapterData.chapter, verse.verse, verse.id); }}
                    >
                      +
                    </button>
                  ) : null}
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
  activeTab: PropTypes.string,
  onAddNote: PropTypes.func,
  syncNotes: PropTypes.bool
};

BiblePane.defaultProps = {
  chapterData: null,
  selectedVerseId: null,
  isLoading: false,
  selectionMode: "verse",
  onSelectionModeChange: () => {},
  activeTab: "commentaries",
  onAddNote: null,
  syncNotes: false
};

export default BiblePane;
