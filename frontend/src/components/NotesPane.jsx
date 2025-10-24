// Notes Pane (left column)
// - Shows ONLY the logged-in user's notes for the currently selected chapter
//   (chapter scoping is handled by the parent App when it loads /notes/me and filters).
// - Allows creating and editing notes, including setting tags (comma-separated).
// - Tags are persisted to the backend and displayed per-note; a simple footer dropdown
//   allows client-side filtering by a single tag.
import PropTypes from "prop-types";

import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../api";

function formatReference(note) {
  if (!note) {
    return "";
  }
  const start = `${note.start_book} ${note.start_chapter}:${note.start_verse}`;
  const end = `${note.end_book} ${note.end_chapter}:${note.end_verse}`;
  const range = start === end ? start : `${start} – ${end}`;
  return note.version_code ? `${range} · ${note.version_code}` : range;
}

function NotesPane({
  notes,
  selectedVerse = null,
  onCreateNote,
  onUpdateNote,
  verses,
  noteError = "",
  isLoading = false,
  isAuthenticated = false,
  currentUser = null,
  backlinks = [],
  isLoadingBacklinks = false,
  syncNotes = false,
  onToggleSync = () => {},
  book,
  chapter
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [endVerseId, setEndVerseId] = useState(null);
  const [tags, setTags] = useState("");

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editEndVerseId, setEditEndVerseId] = useState(null);
  const [editEndOptions, setEditEndOptions] = useState([]);
  const [editTags, setEditTags] = useState("");
  // Client-side tag filter for the visible list
  const [activeTag, setActiveTag] = useState("");
  // Expandable backlinks within the selected verse row
  const [notesBacklinksOpen, setNotesBacklinksOpen] = useState(() => {
    try { return localStorage.getItem('notesBacklinksOpen') === '1'; } catch { return false; }
  });
  const toggleNotesBacklinks = (val) => {
    setNotesBacklinksOpen(val);
    try { localStorage.setItem('notesBacklinksOpen', val ? '1' : '0'); } catch {}
  };

  // Build tag options from the current list so users can filter quickly
  const tagOptions = useMemo(() => {
    const set = new Set();
    (notes || []).forEach(n => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach(t => set.add(t));
      }
    });
    return Array.from(set).sort();
  }, [notes]);

  const verseOptions = useMemo(() => {
    if (!selectedVerse) {
      return [];
    }
    const startIndex = verses.findIndex(verse => verse.id === selectedVerse.id);
    if (startIndex === -1) {
      return [];
    }
    return verses.slice(startIndex).map(verse => ({ id: verse.id, label: `${verse.chapter}:${verse.verse}` }));
  }, [verses, selectedVerse]);

  // Scroll to the first note whose range includes the selected verse; if none, pick the next or previous
  const listRef = useRef(null);
  const contentRef = useRef(null);
  const [extraTopMargin, setExtraTopMargin] = useState(0);
  const scrollToVerseNote = (verseNumber) => {
    const container = contentRef.current;
    const list = listRef.current;
    const allNotes = (activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes) || [];
    if (!container || !list || !allNotes.length) return;
    const inRange = (n) => {
      const sv = Number(n.start_verse) || 0;
      const ev = Number(n.end_verse) || sv;
      const lo = Math.min(sv, ev), hi = Math.max(sv, ev);
      return verseNumber >= lo && verseNumber <= hi;
    };
    let targetNote = allNotes.find(inRange);
    if (!targetNote) {
      // Choose the next note starting after the verse, otherwise the last note before it
      const byStart = [...allNotes].sort((a, b) => (a.start_verse || 0) - (b.start_verse || 0));
      targetNote = byStart.find(n => Number(n.start_verse) >= verseNumber) || byStart[byStart.length - 1];
    }
    if (!targetNote) return;
    const el = list.querySelector(`[data-note-id="${targetNote.id}"]`);
    if (el) {
      const contRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      const top = container.scrollTop + (elRect.top - contRect.top) - 8;
      container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      try { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1200); } catch {}
    }
  };

  useEffect(() => {
    function onBibleSelect(e) {
      const d = e.detail || {};
      if (!d || !Number.isFinite(d.verse)) return;
      const verseNumber = Number(d.verse);
      if (d.source === 'click') {
        // Highlight only on verse click, no scrolling
        if (syncNotes) {
          const row = listRef.current?.querySelector?.(`[data-sync-verse="${verseNumber}"]`);
          if (row) { try { row.classList.add('flash'); setTimeout(() => row.classList.remove('flash'), 800); } catch {} }
        } else {
          const container = listRef.current;
          const targetNote = (activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes)
            .find(n => {
              const sv = Number(n.start_verse) || 0; const ev = Number(n.end_verse) || sv;
              const lo = Math.min(sv, ev), hi = Math.max(sv, ev);
              return verseNumber >= lo && verseNumber <= hi;
            });
          if (container && targetNote) {
            const el = container.querySelector(`[data-note-id="${targetNote.id}"]`);
            if (el) { try { el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 800); } catch {} }
          }
        }
        return;
      }
      // Scroll-align for scroll/programmatic events
      if (syncNotes) {
        const container = contentRef.current; const list = listRef.current;
        if (!container || !list) return;
        const el = list.querySelector(`[data-sync-verse="${verseNumber}"]`);
        if (!el) return;
        const contRect = container.getBoundingClientRect();
        const elRect = el.getBoundingClientRect();
        const top = container.scrollTop + (elRect.top - contRect.top) - 8;
        container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      } else {
        scrollToVerseNote(verseNumber);
      }
    }
    window.addEventListener("bible-verse-selected", onBibleSelect);
    return () => window.removeEventListener("bible-verse-selected", onBibleSelect);
  }, [notes, syncNotes, activeTag]);

  // Do not auto-scroll on selectedVerse changes (clicks should not scroll notes)
  useEffect(() => {}, [selectedVerse?.id, notes?.length]);

  // Measure per-verse row heights and broadcast to Bible when Sync Notes is on
  useEffect(() => {
    if (!syncNotes) return;
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
      const rawTop = list.getBoundingClientRect().top - container.getBoundingClientRect().top;
      const baseTop = rawTop - (extraTopMargin || 0);
      try {
        window.dispatchEvent(new CustomEvent('notes-verse-heights', { detail: { book, chapter, heights, topOffset: baseTop + (extraTopMargin || 0) } }));
      } catch {}
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
  }, [syncNotes, book, chapter, verses, notes, activeTag, extraTopMargin, notesBacklinksOpen, backlinks, isLoadingBacklinks]);

  // Equalize verse row heights with Bible and align tops when syncNotes is on
  useEffect(() => {
    if (!syncNotes) return;
    function onBibleHeights(e) {
      const d = e.detail || {};
      if (d.book !== book || Number(d.chapter) !== Number(chapter)) return;
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
  }, [syncNotes, extraTopMargin]);

  // Create a new note spanning from selectedVerse to endVerseId (if set)
  const handleSubmit = event => {
    event.preventDefault();
    if (!selectedVerse) {
      return;
    }
    onCreateNote({
      title,
      content,
      isPublic,
      endVerseId: endVerseId ? Number(endVerseId) : undefined,
      tags
    });
    setTitle("");
    setContent("");
    setIsPublic(false);
    setEndVerseId(null);
    setTags("");
  };

  // Backlinks in chapter payload are note metadata (not verse references)
  // Format as "Title · by Author" and optionally indicate privacy

  // Begin editing: preload title/content/privacy/tags and build end-verse options for range
  const beginEdit = async note => {
    setEditingNoteId(note.id);
    setEditTitle(note.title || "");
    setEditContent(note.content_markdown || "");
    setEditIsPublic(Boolean(note.is_public));
    setEditEndVerseId(note.end_verse_id);
    setEditTags(Array.isArray(note.tags) && note.tags.length ? note.tags.join(", ") : "");
    try {
      const chapter = await api.fetchChapter(note.version_code, note.start_book, note.start_chapter);
      const startIdx = chapter.verses.findIndex(v => v.id === note.start_verse_id);
      const options = (startIdx >= 0 ? chapter.verses.slice(startIdx) : chapter.verses).map(v => ({ id: v.id, label: `${v.chapter}:${v.verse}` }));
      setEditEndOptions(options);
    } catch {
      setEditEndOptions([]);
    }
  };

  // Reset edit state
  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditTitle("");
    setEditContent("");
    setEditIsPublic(false);
    setEditEndVerseId(null);
    setEditEndOptions([]);
    setEditTags("");
  };

  // Call parent onUpdateNote with only the changed fields
  const saveEdit = async original => {
    const payload = {};
    if ((editTitle || "") !== (original.title || "")) payload.title = editTitle;
    if ((editContent || "") !== (original.content_markdown || "")) payload.content_markdown = editContent;
    if (Boolean(editIsPublic) !== Boolean(original.is_public)) payload.is_public = editIsPublic;
    if (Number(editEndVerseId) !== Number(original.end_verse_id)) payload.end_verse_id = Number(editEndVerseId);
    const originalTags = Array.isArray(original.tags) ? original.tags.join(", ") : "";
    if ((editTags || "") !== originalTags) payload.tags = editTags;
    if (Object.keys(payload).length === 0) {
      cancelEdit();
      return;
    }
    await onUpdateNote(original.id, payload);
    cancelEdit();
  };

  return (
    <div className="pane">
      <div className="pane-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
        <div>My Notes</div>
        <label style={{ fontWeight: 400 }}>
          <input type="checkbox" checked={Boolean(syncNotes)} onChange={onToggleSync} /> Sync Notes
        </label>
      </div>
      <div className="pane-content top-gap" ref={contentRef}>
        {/* Backlinks moved into the selected verse row below. Note creation form removed per request. */}

        {noteError ? <div className="error-text">{noteError}</div> : null}

        {isLoading ? (
          <div className="loading-state">Loading notes...</div>
        ) : syncNotes ? (
          <div className="notes-list" ref={listRef} style={{ marginTop: extraTopMargin ? `${extraTopMargin}px` : undefined }}>
            {verses.map(v => {
              const filtered = (activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes);
              const verseNotes = filtered.filter(n => Number(n.start_verse) === Number(v.verse));
              return (
                <div key={`row-${v.id}`} className="note-row" data-sync-verse={v.verse}>
                  {verseNotes.length === 0 ? (
                    <div className="note-card empty">
                      <div className="empty-text">No notes for this verse yet.</div>
                      <div className="note-meta empty-ref">{book} {v.chapter}:{v.verse}</div>
                      {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && Array.isArray(backlinks) && backlinks.length ? (
                        <div className="backlinks-toggle" style={{ marginTop: '0.5rem' }} role="button" tabIndex={0} onClick={() => toggleNotesBacklinks(!notesBacklinksOpen)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNotesBacklinks(!notesBacklinksOpen); }}}>
                          <span>Backlinks {Array.isArray(backlinks) ? `(${backlinks.length})` : ''}</span>
                          <span className={`caret ${notesBacklinksOpen ? 'open' : ''}`}>▾</span>
                        </div>
                      ) : null}
                      {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && notesBacklinksOpen ? (
                        isLoadingBacklinks ? (
                          <div className="backlinks-box">Loading backlinks…</div>
                        ) : backlinks?.length ? (
                          <div className="backlinks-box">
                            <div className="backlinks-title">Backlinks</div>
                            <div className="backlinks-list">
                              {backlinks.map(b => (
                                <div
                                  key={b.note_id}
                                  className="backlink-item"
                                  onClick={() => {
                                    try { window.dispatchEvent(new CustomEvent("open-verse", { detail: { book: b.source_book, chapter: b.source_chapter, verse: b.source_verse } })); } catch {}
                                  }}
                                  style={{ cursor: 'pointer' }}
                                >
                                  <div className="note-title" style={{ fontWeight: 600 }}>{b.note_title || "Untitled"}</div>
                                  <div className="note-meta">
                                    by {b.note_owner_name || "Unknown"}{b.note_is_public ? "" : " (private)"}
                                    {b.source_book && b.source_chapter && b.source_verse ? (
                                      <> · {b.source_book} {b.source_chapter}:{b.source_verse}</>
                                    ) : null}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : null
                      ) : null}
                    </div>
                  ) : null}
                  {verseNotes.map((note, idx) => (
                    <div key={note.id} className="note-card" data-note-id={note.id} data-start-verse={note.start_verse} data-end-verse={note.end_verse || note.start_verse}>
                      {editingNoteId === note.id ? (
                        <form className="notes-form" onSubmit={e => { e.preventDefault(); saveEdit(note); }}>
                          <input
                            type="text"
                            placeholder="Note title"
                            value={editTitle}
                            onChange={e => setEditTitle(e.target.value)}
                          />
                          <textarea
                            placeholder="Markdown content"
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                          />
                          <div className="notes-form-row">
                            <label>
                              <input
                                type="checkbox"
                                checked={editIsPublic}
                                onChange={e => setEditIsPublic(e.target.checked)}
                              />
                              Public
                            </label>
                            <select
                              value={editEndVerseId || ""}
                              onChange={e => setEditEndVerseId(e.target.value || null)}
                            >
                              <option value="">Single verse</option>
                              {editEndOptions.map(opt => (
                                <option key={opt.id} value={opt.id}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          <input
                            type="text"
                            placeholder="Tags (comma-separated)"
                            value={editTags}
                            onChange={e => setEditTags(e.target.value)}
                          />
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <button type="submit">Save</button>
                            <button type="button" onClick={cancelEdit}>Cancel</button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {Array.isArray(note.tags) && note.tags.length ? (
                            <div className="note-meta" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                              <span>Tags:</span>
                              <span>{note.tags.map((t, idx) => (
                                <span key={`${t}-${idx}`}>
                                  {idx > 0 ? ", " : ""}
                                  <button type="button" className="note-link" onClick={() => setActiveTag(t)}>{t}</button>
                                </span>
                              ))}</span>
                            </div>
                          ) : null}
                          <div className="note-header">
                            <span className="note-title">{note.title || "Untitled"}</span>
                            <span className="note-meta">
                              {note.is_public ? "Public" : "Private"} · {new Date(note.updated_at).toLocaleString()}
                            </span>
                          </div>
                          <div className="note-meta">{formatReference(note)}</div>
                          {note.owner_display_name && (!currentUser || currentUser.id !== note.owner_id) ? (
                            <div className="note-meta">By {note.owner_display_name}</div>
                          ) : null}
                          <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                          {note.cross_references.length ? (
                            <div className="note-meta">References: {note.cross_references.join(", ")}</div>
                          ) : null}
                          <br></br>
                          {Array.isArray(note.tags) && note.tags.length ? (
                            <div className="note-meta">Tags: {note.tags.join(", ")}</div>
                          ) : null}
                          <div style={{ marginTop: "0.5rem" }}>
                            <button type="button" onClick={() => beginEdit(note)}>Edit</button>
                          </div>
                          {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && idx === 0 && Array.isArray(backlinks) && backlinks.length ? (
                            <div className="backlinks-toggle" style={{ marginTop: '0.5rem' }} role="button" tabIndex={0} onClick={() => toggleNotesBacklinks(!notesBacklinksOpen)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleNotesBacklinks(!notesBacklinksOpen); }}}>
                              <span>Backlinks {Array.isArray(backlinks) ? `(${backlinks.length})` : ''}</span>
                              <span className={`caret ${notesBacklinksOpen ? 'open' : ''}`}>▾</span>
                            </div>
                          ) : null}
                          {selectedVerse && Number(v.verse) === Number(selectedVerse.verse) && idx === 0 && notesBacklinksOpen ? (
                            isLoadingBacklinks ? (
                              <div className="backlinks-box">Loading backlinks…</div>
                            ) : backlinks?.length ? (
                              <div className="backlinks-box">
                                <div className="backlinks-title">Backlinks</div>
                                <div className="backlinks-list">
                                  {backlinks.map(b => (
                                    <div
                                      key={b.note_id}
                                      className="backlink-item"
                                      onClick={() => {
                                        try { window.dispatchEvent(new CustomEvent("open-verse", { detail: { book: b.source_book, chapter: b.source_chapter, verse: b.source_verse } })); } catch {}
                                      }}
                                      style={{ cursor: 'pointer' }}
                                    >
                                      <div className="note-title" style={{ fontWeight: 600 }}>{b.note_title || "Untitled"}</div>
                                      <div className="note-meta">
                                        by {b.note_owner_name || "Unknown"}{b.note_is_public ? "" : " (private)"}
                                        {b.source_book && b.source_chapter && b.source_verse ? (
                                          <> · {b.source_book} {b.source_chapter}:{b.source_verse}</>
                                        ) : null}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null
                          ) : null}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : (activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes).length ? (
          <div className="notes-list" ref={listRef}>
            {(activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes).map(note => (
              <div key={note.id} className="note-card" data-note-id={note.id} data-start-verse={note.start_verse} data-end-verse={note.end_verse || note.start_verse}>
                {editingNoteId === note.id ? (
                  <form className="notes-form" onSubmit={e => { e.preventDefault(); saveEdit(note); }}>
                    <input
                      type="text"
                      placeholder="Note title"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                    />
                    <textarea
                      placeholder="Markdown content"
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                    />
                    <div className="notes-form-row">
                      <label>
                        <input
                          type="checkbox"
                          checked={editIsPublic}
                          onChange={e => setEditIsPublic(e.target.checked)}
                        />
                        Public
                      </label>
                      <select
                        value={editEndVerseId || ""}
                        onChange={e => setEditEndVerseId(e.target.value || null)}
                      >
                        <option value="">Single verse</option>
                        {editEndOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Tags (comma-separated)"
                      value={editTags}
                      onChange={e => setEditTags(e.target.value)}
                    />
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="submit">Save</button>
                      <button type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
                    {Array.isArray(note.tags) && note.tags.length ? (
                      <div className="note-meta" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                        <span>Tags:</span>
                        <span>{note.tags.map((t, idx) => (
                          <span key={`${t}-${idx}`}>
                            {idx > 0 ? ", " : ""}
                            <button type="button" className="note-link" onClick={() => setActiveTag(t)}>{t}</button>
                          </span>
                        ))}</span>
                      </div>
                    ) : null}
                    <div className="note-header">
                      <span className="note-title">{note.title || "Untitled"}</span>
                      <span className="note-meta">
                        {note.is_public ? "Public" : "Private"} · {new Date(note.updated_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="note-meta">{formatReference(note)}</div>
                    {note.owner_display_name && (!currentUser || currentUser.id !== note.owner_id) ? (
                      <div className="note-meta">By {note.owner_display_name}</div>
                    ) : null}
                    <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                    {note.cross_references.length ? (
                      <div className="note-meta">References: {note.cross_references.join(", ")}</div>
                    ) : null}
                    <br></br>
                    {Array.isArray(note.tags) && note.tags.length ? (
                      <div className="note-meta">Tags: {note.tags.join(", ")}</div>
                    ) : null}
                    <div style={{ marginTop: "0.5rem" }}>
                      <button type="button" onClick={() => beginEdit(note)}>Edit</button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">No notes yet for this chapter.</div>
        )}
      </div>
      {tagOptions.length ? (
        <div className="pane-footer" style={{ padding: "0.5rem" }}>
          <div className="notes-form-row" style={{ alignItems: "center" }}>
            <label htmlFor="tagFilter">Filter by tag:</label>
            <select id="tagFilter" value={activeTag} onChange={e => setActiveTag(e.target.value)}>
              <option value="">All</option>
              {tagOptions.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {activeTag ? (
              <button type="button" onClick={() => setActiveTag("")}>Clear</button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

NotesPane.propTypes = {
  notes: PropTypes.array.isRequired,
  selectedVerse: PropTypes.shape({
    id: PropTypes.number.isRequired,
    chapter: PropTypes.number.isRequired,
    verse: PropTypes.number.isRequired
  }),
  onCreateNote: PropTypes.func.isRequired,
  onUpdateNote: PropTypes.func.isRequired,
  verses: PropTypes.array.isRequired,
  noteError: PropTypes.string,
  isLoading: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  currentUser: PropTypes.shape({
    id: PropTypes.number.isRequired
  }),
  backlinks: PropTypes.array,
  isLoadingBacklinks: PropTypes.bool,
  syncNotes: PropTypes.bool,
  onToggleSync: PropTypes.func,
  book: PropTypes.string,
  chapter: PropTypes.number
};

export default NotesPane;
