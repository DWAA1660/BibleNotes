import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { api } from "../api";

function ManuscriptsPane({ book, chapter, activeTab, onChangeTab }) {
  const [available, setAvailable] = useState([]);
  const [selectedEdition, setSelectedEdition] = useState(() => localStorage.getItem("selectedManuscriptEdition") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [verses, setVerses] = useState([]);
  const [editionMeta, setEditionMeta] = useState(null);
  const [selectedWord, setSelectedWord] = useState(null);
  const [overrides, setOverrides] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("alignmentOverrides") || "{}") || {};
    } catch {
      return {};
    }
  });

  const tokenize = text => (text || "").trim().split(/\s+/).filter(Boolean);
  const GREEK_STOP = new Set([
    "και","δε","γαρ","ο","η","το","οι","αι","τα","του","της","των","τω","τη","τοις","ταις","τον","την","τους","τας",
    "εν","εις","εκ","εξ","προς","κατα","δια","περι","υπο","υπερ","αντι","απο","μετα","παρα","επι","ως","ουν","τε","μη","ου",
    "τις","τι","ἄν","αν"
  ]);
  const greekContentIndices = tokens => {
    const idx = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i].toLowerCase();
      if (!GREEK_STOP.has(t) && t.replace(/[^\p{L}]+/gu, "").length > 1) idx.push(i);
    }
    return idx;
  };

  // Monotonic sequence alignment (global) over lengths only.
  // Align English content positions [0..E-1] to Greek content positions [0..G-1]
  // using steps (i+1,j), (i,j+1), (i+1,j+1). Cost favors staying near the diagonal.
  function alignMonotonicByCounts(E, G) {
    if (E <= 0 || G <= 0) return [];
    const dp = Array.from({ length: E + 1 }, () => new Array(G + 1).fill(0));
    const prev = Array.from({ length: E + 1 }, () => new Array(G + 1).fill(0)); // 1=diag,2=up(i-1),3=left(j-1)
    const cost = (i, j) => {
      // normalized positions in [0,1]
      const ei = E === 1 ? 0 : i / (E - 1);
      const gj = G === 1 ? 0 : j / (G - 1);
      // smaller cost near diagonal; add small penalty for gaps implicitly via path length
      return Math.abs(ei - gj);
    };
    // init
    dp[0][0] = 0;
    for (let i = 1; i <= E; i++) {
      dp[i][0] = dp[i - 1][0] + cost(i - 1, 0);
      prev[i][0] = 2; // up
    }
    for (let j = 1; j <= G; j++) {
      dp[0][j] = dp[0][j - 1] + cost(0, j - 1);
      prev[0][j] = 3; // left
    }
    // fill
    for (let i = 1; i <= E; i++) {
      for (let j = 1; j <= G; j++) {
        const cDiag = dp[i - 1][j - 1] + cost(i - 1, j - 1);
        const cUp = dp[i - 1][j] + cost(i - 1, j);
        const cLeft = dp[i][j - 1] + cost(i, j - 1);
        let best = cDiag; let from = 1;
        if (cUp < best) { best = cUp; from = 2; }
        if (cLeft < best) { best = cLeft; from = 3; }
        dp[i][j] = best; prev[i][j] = from;
      }
    }
    // backtrack to get mapping for each English index (content): mapE[i] to some j
    const mapE = new Array(E).fill(0);
    let i = E, j = G;
    while (i > 0 || j > 0) {
      const p = prev[i][j];
      if (p === 1) {
        // diagonal: i-1 aligned to j-1
        mapE[i - 1] = j - 1; i -= 1; j -= 1;
      } else if (p === 2) {
        // up: i-1 aligned to current j (gap in Greek)
        mapE[i - 1] = Math.max(0, Math.min(G - 1, j)); i -= 1;
      } else {
        // left: gap in English, move Greek
        j -= 1;
      }
    }
    // enforce monotonic bounds
    for (let k = 1; k < E; k++) mapE[k] = Math.max(mapE[k], mapE[k - 1]);
    for (let k = E - 2; k >= 0; k--) mapE[k] = Math.min(mapE[k], mapE[k + 1]);
    return mapE;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.fetchManuscriptsAvailable(book, chapter);
        if (cancelled) return;
        const editions = data?.editions || [];
        setAvailable(editions);
        // Ensure selection is valid for this book/chapter
        let next = selectedEdition;
        if (!next || !editions.some(e => e.code === next)) {
          next = editions.length ? editions[0].code : "";
        }
        setSelectedEdition(next);
      } catch {
        if (!cancelled) {
          setAvailable([]);
          setSelectedEdition("");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter]);

  useEffect(() => {
    if (selectedEdition) {
      localStorage.setItem("selectedManuscriptEdition", selectedEdition);
    } else {
      localStorage.removeItem("selectedManuscriptEdition");
    }
  }, [selectedEdition]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedEdition) {
      setVerses([]);
      setEditionMeta(null);
      return;
    }
    setIsLoading(true);
    setError("");
    (async () => {
      try {
        const chapterData = await api.fetchManuscriptChapter(selectedEdition, book, chapter);
        if (cancelled) return;
        setVerses(chapterData?.verses || []);
        setEditionMeta(chapterData?.edition || null);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load manuscript chapter");
          setVerses([]);
          setEditionMeta(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedEdition, book, chapter]);

  useEffect(() => {
    const last = window.localStorage.getItem("wordSelect");
    if (last) {
      try {
        const obj = JSON.parse(last);
        if (obj && obj.book === book && obj.chapter === chapter) {
          setSelectedWord(obj);
        }
      } catch {}
    }
    const handler = e => {
      const d = e.detail || {};
      if (d.book === book && d.chapter === chapter) {
        setSelectedWord(d);
      }
    };
    window.addEventListener("word-select", handler);
    return () => window.removeEventListener("word-select", handler);
  }, [book, chapter]);

  const overrideKey = selectedWord ? `${book}|${chapter}|${selectedWord.verse}|${selectedWord.englishNonStopIndex ?? selectedWord.index}` : null;

  const saveOverrides = next => {
    setOverrides(next);
    try { localStorage.setItem("alignmentOverrides", JSON.stringify(next)); } catch {}
  };

  const nudgeHighlight = delta => {
    if (!overrideKey) return;
    const current = overrides[overrideKey] || 0;
    const next = { ...overrides, [overrideKey]: current + delta };
    saveOverrides(next);
  };

  const listRef = useRef(null);
  const contentRef = useRef(null);
  const [msTopOffset, setMsTopOffset] = useState(0);
  const [extraTopMargin, setExtraTopMargin] = useState(0);
  const msHeightsRef = useRef({});
  const [selectedVerseNo, setSelectedVerseNo] = useState(null);

  // Measure manuscript verse heights and broadcast to Bible pane
  // Goal: keep manuscript and bible rows the same height and aligned from the top
  // - We measure each verse card's natural height (without minHeight)
  // - We compute our base top offset relative to the scroll container
  // - We report our effective top (base + any margin) so Bible can compute its spacer
  useEffect(() => {
    if (activeTab !== "manuscripts") {
      if (extraTopMargin !== 0) setExtraTopMargin(0);
      return undefined;
    }
    function measureAndEmit() {
      // Re-measure all verse cards and our top offset
      const root = listRef.current;
      const container = contentRef.current;
      if (!root || !container) return;
      const cards = Array.from(root.querySelectorAll('[data-ms-verse]'));
      const heights = {};
      for (const el of cards) {
        const v = Number(el.getAttribute('data-ms-verse'));
        const prevMinHeight = el.style.minHeight;
        if (prevMinHeight) el.style.minHeight = '';
        const rect = el.getBoundingClientRect().height;
        if (prevMinHeight) el.style.minHeight = prevMinHeight;
        if (v) heights[v] = rect;
      }
      // Base offset excludes any extra margin we apply for alignment
      const rawTopOffset = Math.max(0, root.getBoundingClientRect().top - container.getBoundingClientRect().top);
      const baseTopOffset = Math.max(0, rawTopOffset - extraTopMargin);
      setMsTopOffset(baseTopOffset);
      msHeightsRef.current = heights;
      // Report our own effective top so Bible can compute spacer = msBase - myBase
      window.dispatchEvent(new CustomEvent('manuscripts-verse-heights', { detail: { book, chapter, heights, topOffset: baseTopOffset + extraTopMargin } }));
    }
    const rAF = () => requestAnimationFrame(() => {
      measureAndEmit();
      setTimeout(measureAndEmit, 0);
    });
    rAF();
    window.addEventListener('resize', rAF);
    // Observe content/list resizes (e.g., text wrapping, fonts)
    let ro;
    try {
      const targetA = contentRef.current;
      const targetB = listRef.current;
      if (window.ResizeObserver && (targetA || targetB)) {
        ro = new ResizeObserver(() => rAF());
        if (targetA) ro.observe(targetA);
        if (targetB) ro.observe(targetB);
      }
    } catch {}
    return () => {
      window.removeEventListener('resize', rAF);
      try { if (ro) ro.disconnect(); } catch {}
    };
  }, [activeTab, book, chapter, verses, selectedEdition, extraTopMargin]);

  // Listen for Bible heights to equalize both panes and align top when Bible has larger header
  // - We set minHeight on each manuscript verse to max(msHeight, bibleHeight)
  // - We compute the necessary extra top margin so our effective top matches Bible's base top
  // - We re-emit heights with our effective top so Bible can maintain symmetry
  useEffect(() => {
    function onBibleHeights(e) {
      const d = e.detail || {};
      if (d.book !== book || d.chapter !== chapter) return;
      const list = listRef.current;
      if (!list) return;
      const items = Array.from(list.querySelectorAll('[data-ms-verse]'));
      const map = d.heights || {};
      const equalHeights = {};
      for (const el of items) {
        const v = Number(el.getAttribute('data-ms-verse'));
        const msH = msHeightsRef.current[v] || el.getBoundingClientRect().height;
        const biH = map[v] || 0;
        const h = Math.max(msH, biH);
        el.style.minHeight = h ? `${Math.ceil(h)}px` : '';
        if (v) equalHeights[v] = Math.ceil(h);
      }
      // Desired effective top is what Bible measured as its base top
      const rawTarget = Number(d.topOffset);
      const targetOffset = Number.isFinite(rawTarget) ? Math.max(0, rawTarget) : 0;
      // Hysteresis: round and only update when change is > 1px to avoid drift/jitter
      const desiredMargin = Math.max(0, Math.round(targetOffset - msTopOffset));
      const diff = Math.abs(desiredMargin - extraTopMargin);
      const marginChanged = diff > 1; // require >1px change to avoid drift
      if (marginChanged) {
        setExtraTopMargin(desiredMargin);
      }
      const appliedMargin = marginChanged ? desiredMargin : extraTopMargin;
      // Re-dispatch equalized heights so Bible applies the exact same values
      try {
        // Re-emit with our own effective top so Bible can align to it
        window.dispatchEvent(new CustomEvent('manuscripts-verse-heights', { detail: { book, chapter, heights: equalHeights, topOffset: msTopOffset + appliedMargin } }));
      } catch {}
    }
    window.addEventListener('bible-verse-heights', onBibleHeights);
    return () => window.removeEventListener('bible-verse-heights', onBibleHeights);
  }, [book, chapter, msTopOffset, extraTopMargin]);

  // Highlight the manuscript verse when a Bible verse is selected
  useEffect(() => {
    function onBibleSelect(e) {
      const d = e.detail || {};
      if (d.book === book && d.chapter === chapter) {
        setSelectedVerseNo(d.verse);
      }
    }
    window.addEventListener('bible-verse-selected', onBibleSelect);
    return () => window.removeEventListener('bible-verse-selected', onBibleSelect);
  }, [book, chapter]);

  return (
    <div className="pane">
      <div className="pane-header tabs-header">
        <div className="tabbar">
          <button
            type="button"
            className={`tab ${activeTab === "commentaries" ? "active" : ""}`}
            onClick={() => onChangeTab("commentaries")}
          >
            Commentaries
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "manuscripts" ? "active" : ""}`}
            onClick={() => onChangeTab("manuscripts")}
          >
            Manuscripts
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "concordance" ? "active" : ""}`}
            onClick={() => onChangeTab("concordance")}
          >
            Concordance
          </button>
        </div>
        <div style={{ marginLeft: "auto" }}>
        </div>
      </div>
      <div className="pane-content" ref={contentRef}>
        <div className="commentary-section">
          <div className="section-title">Select Edition</div>
          {available.length ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                value={selectedEdition || ""}
                onChange={event => setSelectedEdition(event.target.value)}
              >
                {available.map(e => (
                  <option key={e.code} value={e.code}>
                    {e.name} ({e.code})
                  </option>
                ))}
              </select>
              {selectedEdition ? (
                <button type="button" aria-label="Clear selection" onClick={() => setSelectedEdition("")}>×</button>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">No manuscript editions available for this book yet.</div>
          )}
        </div>

        {editionMeta ? (
          <div className="commentary-section">
            <div className="section-title">Edition</div>
            <div className="note-meta">
              {editionMeta.name} · {editionMeta.language} · {editionMeta.scope}
              {editionMeta.license_name ? ` · ${editionMeta.license_name}` : ""}
            </div>
          </div>
        ) : null}

        <div className="commentary-section">
          <div className="section-title">{book} {chapter}</div>
          {isLoading ? (
            <div className="loading-state">Loading…</div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : verses.length ? (
            <div
              className="entries-list"
              ref={listRef}
              style={{ direction: (editionMeta?.language === "heb" || editionMeta?.language === "arc" || editionMeta?.language === "syr") ? "rtl" : "ltr", textAlign: (editionMeta?.language === "heb" || editionMeta?.language === "arc" || editionMeta?.language === "syr") ? "right" : "left", marginTop: extraTopMargin ? `${extraTopMargin}px` : undefined }}
            >
              {verses.map(v => (
                <div key={v.id} className={`entry-card${selectedVerseNo === v.verse ? ' active' : ''}`} data-ms-verse={v.verse}>
                  <div className="note-meta">{v.chapter}:{v.verse}</div>
                  <div>
                    <span>{v.text}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Select an edition to view this chapter.</div>
          )}
        </div>
      </div>
    </div>
  );
}

ManuscriptsPane.propTypes = {
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  activeTab: PropTypes.string,
  onChangeTab: PropTypes.func
};

ManuscriptsPane.defaultProps = {
  activeTab: "manuscripts",
  onChangeTab: () => {}
};

export default ManuscriptsPane;
