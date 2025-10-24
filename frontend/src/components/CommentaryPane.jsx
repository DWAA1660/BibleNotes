import PropTypes from "prop-types";
import { useEffect, useRef, useState } from "react";

function formatReference(note) {
  if (!note) return "";
  const start = `${note.start_book} ${note.start_chapter}:${note.start_verse}`;
  const end = `${note.end_book} ${note.end_chapter}:${note.end_verse}`;
  const range = start === end ? start : `${start} – ${end}`;
  return note.version_code ? `${range} · ${note.version_code}` : range;
}

function CommentaryPane({
  activeTab,
  onChangeTab,
  isAuthenticated,
  authors,
  selectedAuthorId,
  onSelectAuthor,
  authorNotes,
  isLoading,
  selectedVerse,
  book,
  chapter,
  verses,
  syncNotes
}) {
  const selectedCanon = selectedVerse?.canonical_id;
  const backlinks = Array.isArray(authorNotes) && selectedCanon
    ? authorNotes.filter(n => Array.isArray(n.cross_references) && n.cross_references.includes(selectedCanon))
    : [];
  const BOOKS = [
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth",
    "1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther",
    "Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations",
    "Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk",
    "Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans",
    "1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians",
    "2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter",
    "1 John","2 John","3 John","Jude","Revelation"
  ];
  const order = new Map(BOOKS.map((b, i) => [b, i]));
  const sortedBacklinks = [...backlinks].sort((a, b) => {
    const ai = order.get(a.start_book) ?? 999;
    const bi = order.get(b.start_book) ?? 999;
    if (ai !== bi) return ai - bi;
    const ac = Number(a.start_chapter) || 0;
    const bc = Number(b.start_chapter) || 0;
    if (ac !== bc) return ac - bc;
    const av = Number(a.start_verse) || 0;
    const bv = Number(b.start_verse) || 0;
    return av - bv;
  });

  const openNoteAnchor = note => {
    if (!note) return;
    const b = note.start_book, c = note.start_chapter, v = note.start_verse;
    if (!b || !c || !v) return;
    try { window.dispatchEvent(new CustomEvent("open-verse", { detail: { book: b, chapter: c, verse: v } })); } catch {}
  };
  // Expandable toggles
  const [commBacklinksOpen, setCommBacklinksOpen] = useState(() => {
    try { return localStorage.getItem("commentaryBacklinksOpen") === "1"; } catch { return false; }
  });
  const toggleCommBacklinks = (val) => {
    setCommBacklinksOpen(val);
    try { localStorage.setItem("commentaryBacklinksOpen", val ? "1" : "0"); } catch {}
  };
  const listRef = useRef(null);
  const contentRef = useRef(null);
  const [extraTopMargin, setExtraTopMargin] = useState(0);
  const scrollToVerse = (b, c, v) => {
    if (syncNotes) {
      const container = contentRef.current;
      const list = listRef.current;
      if (!container || !list) return;
      const el = list.querySelector(`[data-sync-verse="${v}"]`);
      if (!el) return;
      const contRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const top = container.scrollTop + (elRect.top - contRect.top) - 8;
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      try { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 800); } catch {}
    } else {
      const container = listRef.current;
      if (!container || !Array.isArray(authorNotes) || !authorNotes.length) return;
      const target = authorNotes.find(n => n.start_book === b && Number(n.start_chapter) === Number(c) && (
        Number(v) >= Math.min(Number(n.start_verse) || 0, Number(n.end_verse) || Number(n.start_verse) || 0) &&
        Number(v) <= Math.max(Number(n.start_verse) || 0, Number(n.end_verse) || Number(n.start_verse) || 0)
      ));
      if (!target) return;
      const el = container.querySelector(`[data-note-id="${target.id}"]`);
      if (el && el.scrollIntoView) {
        el.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        try { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 800); } catch {}
      }
    }
  };

  useEffect(() => {
    function onBibleSelect(e) {
      const d = e.detail || {};
      if (!d || !d.book || !d.chapter || !d.verse) return;
      if (activeTab !== "commentaries") return;
      if (d.source === 'click') {
        const vn = Number(d.verse);
        if (syncNotes) {
          const row = listRef.current?.querySelector?.(`[data-sync-verse="${vn}"]`);
          const target = row ? row.querySelector('.entry-card') || row : null;
          if (target) { try { target.classList.add('flash'); setTimeout(() => target.classList.remove('flash'), 800); } catch {} }
        } else {
          const container = listRef.current;
          const target = authorNotes.find(n => n.start_book === d.book && Number(n.start_chapter) === Number(d.chapter) && Number(n.start_verse) === vn);
          if (container && target) {
            const el = container.querySelector(`[data-note-id="${target.id}"]`);
            if (el) { try { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 800); } catch {} }
          }
        }
        return;
      }
      scrollToVerse(d.book, d.chapter, d.verse);
    }
    window.addEventListener("bible-verse-selected", onBibleSelect);
    return () => window.removeEventListener("bible-verse-selected", onBibleSelect);
  }, [authorNotes, activeTab, syncNotes]);

  useEffect(() => {
    if (activeTab !== "commentaries") return;
    const b = selectedVerse?.book, c = selectedVerse?.chapter, v = selectedVerse?.verse;
    if (b && c && v && !syncNotes) scrollToVerse(b, c, v);
  }, [selectedVerse?.id, authorNotes?.length, activeTab, syncNotes]);

  // Equalize verse row heights with Bible and align tops when syncNotes is on
  useEffect(() => {
    if (!syncNotes || activeTab !== 'commentaries') return;
    function onBibleHeights(e) {
      const d = e.detail || {};
      const list = listRef.current; const container = contentRef.current;
      if (!list || !container) return;
      const items = Array.from(list.querySelectorAll('[data-sync-verse]'));
      const map = d.heights || {};
      for (const el of items) {
        const v = Number(el.getAttribute('data-sync-verse'));
        const h = Math.ceil(map[v] || 0);
        el.style.minHeight = '';
        el.style.height = h ? `${h}px` : '';
      }
      const rawTop = list.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const baseTop = rawTop - (extraTopMargin || 0);
      const target = Number(d.topOffset) || 0;
      const desired = Math.round(target - baseTop);
      if (Math.abs(desired - (extraTopMargin || 0)) > 1) setExtraTopMargin(desired);
    }
    window.addEventListener('bible-verse-heights', onBibleHeights);
    return () => window.removeEventListener('bible-verse-heights', onBibleHeights);
  }, [syncNotes, activeTab, extraTopMargin]);

  useEffect(() => {
    if (!syncNotes || activeTab !== 'commentaries') return;
    function measureAndEmit() {
      const list = listRef.current; const container = contentRef.current;
      if (!list || !container) return;
      const rows = Array.from(list.querySelectorAll('[data-sync-verse]'));
      const heights = {};
      for (const el of rows) {
        const v = Number(el.getAttribute('data-sync-verse')) || 0;
        const prevH = el.style.height; const prevMin = el.style.minHeight;
        if (prevH) el.style.height = '';
        if (prevMin) el.style.minHeight = '';
        const h = el.getBoundingClientRect().height;
        if (prevH) el.style.height = prevH;
        if (prevMin) el.style.minHeight = prevMin;
        if (v) heights[v] = h;
      }
      const rawTop = Math.max(0, list.getBoundingClientRect().top - container.getBoundingClientRect().top);
      const baseTop = Math.max(0, rawTop - (extraTopMargin || 0));
      try { window.dispatchEvent(new CustomEvent('commentary-verse-heights', { detail: { book, chapter, heights, topOffset: baseTop + (extraTopMargin || 0) } })); } catch {}
    }
    const rAF = () => requestAnimationFrame(() => { measureAndEmit(); setTimeout(measureAndEmit, 0); });
    rAF();
    window.addEventListener('resize', rAF);
    let ro;
    try {
      if (window.ResizeObserver) {
        ro = new ResizeObserver(() => rAF());
        if (contentRef.current) ro.observe(contentRef.current);
        if (listRef.current) ro.observe(listRef.current);
      }
    } catch {}
    return () => {
      window.removeEventListener('resize', rAF);
      try { if (ro) ro.disconnect(); } catch {}
    };
  }, [syncNotes, activeTab, book, chapter, verses, authorNotes, extraTopMargin, commBacklinksOpen, sortedBacklinks.length]);

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
      </div>
      <div className="pane-content top-gap" ref={contentRef}>
        <div className="commentary-controls">
          <label htmlFor="commSelect">Select commentator:</label>
          <select
            id="commSelect"
            value={selectedAuthorId || ""}
            onChange={event => onSelectAuthor(event.target.value ? Number(event.target.value) : null)}
          >
            <option value="">Choose…</option>
            {authors.map(a => (
              <option key={a.author_id} value={a.author_id}>
                {a.author_display_name || "Unknown"}
              </option>
            ))}
          </select>
          {selectedAuthorId ? (
            <button type="button" aria-label="Clear selection" onClick={() => onSelectAuthor(null)}>×</button>
          ) : null}
        </div>

        <div className="commentary-section">
          {isLoading ? (
            <div className="loading-state">Loading notes…</div>
          ) : authorNotes.length ? (
            syncNotes ? (
              <div className="entries-list" ref={listRef} style={{ marginTop: extraTopMargin ? `${extraTopMargin}px` : undefined }}>
                {Array.isArray(verses) && verses.length ? verses.map(v => {
                  const verseNotes = authorNotes.filter(n => Number(n.start_verse) === Number(v.verse));
                  return (
                    <div key={`row-${v.id}`} className="entry-row" data-sync-verse={v.verse}>
                      {verseNotes.length === 0 ? (
                        <div className="entry-card empty">
                          {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && sortedBacklinks.length ? (
                            <div className="backlinks-toggle" style={{ marginTop: '0.5rem' }} role="button" tabIndex={0} onClick={() => toggleCommBacklinks(!commBacklinksOpen)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCommBacklinks(!commBacklinksOpen); }}}>
                              <span>Backlinks {sortedBacklinks.length ? `(${sortedBacklinks.length})` : ''}</span>
                              <span className={`caret ${commBacklinksOpen ? 'open' : ''}`}>▾</span>
                            </div>
                          ) : null}
                          {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && commBacklinksOpen && sortedBacklinks.length ? (
                            <div className="backlinks-box">
                              <div className="backlinks-title">Backlinks</div>
                              <div className="backlinks-list">
                                {sortedBacklinks.map(b => (
                                  <div key={b.id} className="backlink-item" onClick={() => openNoteAnchor(b)} style={{ cursor: 'pointer' }}>
                                    <div className="note-title" style={{ fontWeight: 600 }}>{b.title || 'Untitled'}</div>
                                    <div className="note-meta">{b.start_book} {b.start_chapter}:{b.start_verse}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {verseNotes.map((note, idx) => (
                        <div key={note.id} className="entry-card" data-note-id={note.id} data-start-verse={note.start_verse} data-end-verse={note.end_verse || note.start_verse} data-book={note.start_book} data-chapter={note.start_chapter}>
                          <div className="note-meta">{formatReference(note)} · Updated {new Date(note.updated_at).toLocaleString()}</div>
                          <div className="note-title" style={{ fontWeight: 600 }}>{note.title || "Untitled"}</div>
                          <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                          {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && idx === 0 && sortedBacklinks.length ? (
                            <div className="backlinks-toggle" style={{ marginTop: '0.5rem' }} role="button" tabIndex={0} onClick={() => toggleCommBacklinks(!commBacklinksOpen)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCommBacklinks(!commBacklinksOpen); }}}>
                              <span>Backlinks {sortedBacklinks.length ? `(${sortedBacklinks.length})` : ''}</span>
                              <span className={`caret ${commBacklinksOpen ? 'open' : ''}`}>▾</span>
                            </div>
                          ) : null}
                          {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && idx === 0 && commBacklinksOpen && sortedBacklinks.length ? (
                            <div className="backlinks-box">
                              <div className="backlinks-title">Backlinks</div>
                              <div className="backlinks-list">
                                {sortedBacklinks.map(b => (
                                  <div key={b.id} className="backlink-item" onClick={() => openNoteAnchor(b)} style={{ cursor: 'pointer' }}>
                                    <div className="note-title" style={{ fontWeight: 600 }}>{b.title || 'Untitled'}</div>
                                    <div className="note-meta">{b.start_book} {b.start_chapter}:{b.start_verse}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  );
                }) : null}
              </div>
            ) : (
              <div className="entries-list" ref={listRef}>
                {authorNotes.map(note => (
                  <div key={note.id} className="entry-card" data-note-id={note.id} data-start-verse={note.start_verse} data-end-verse={note.end_verse || note.start_verse} data-book={note.start_book} data-chapter={note.start_chapter}>
                    <div className="note-meta">{formatReference(note)} · Updated {new Date(note.updated_at).toLocaleString()}</div>
                    <div className="note-title" style={{ fontWeight: 600 }}>{note.title || "Untitled"}</div>
                    <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="empty-state">Select a commentator to view notes for this chapter.</div>
          )}
        </div>
      </div>
    </div>
  );
}

CommentaryPane.propTypes = {
  activeTab: PropTypes.string,
  onChangeTab: PropTypes.func,
  isAuthenticated: PropTypes.bool,
  authors: PropTypes.arrayOf(
    PropTypes.shape({
      author_id: PropTypes.number.isRequired,
      author_display_name: PropTypes.string
    })
  ).isRequired,
  selectedAuthorId: PropTypes.number,
  onSelectAuthor: PropTypes.func.isRequired,
  authorNotes: PropTypes.array.isRequired,
  isLoading: PropTypes.bool,
  selectedVerse: PropTypes.object,
  book: PropTypes.string,
  chapter: PropTypes.number,
  verses: PropTypes.array,
  syncNotes: PropTypes.bool
};

CommentaryPane.defaultProps = {
  activeTab: "commentaries",
  onChangeTab: () => {},
  isAuthenticated: false,
  selectedAuthorId: null,
  isLoading: false
};

export default CommentaryPane;
