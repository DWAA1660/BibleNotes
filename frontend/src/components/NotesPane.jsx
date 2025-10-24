// Notes Pane (left column)
// - Shows ONLY the logged-in user's notes for the currently selected chapter
//   (chapter scoping is handled by the parent App when it loads /notes/me and filters).
// - Allows creating and editing notes, including setting tags (comma-separated).
// - Tags are persisted to the backend and displayed per-note; a simple footer dropdown
//   allows client-side filtering by a single tag.
import PropTypes from "prop-types";

import { useEffect, useMemo, useState } from "react";
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
  isLoadingBacklinks = false
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
      <div className="pane-header">My Notes</div>
      <div className="pane-content">
        {selectedVerse ? (
          <div className="note-context">
            Selected verse: {selectedVerse.chapter}:{selectedVerse.verse}
          </div>
        ) : (
          <div className="empty-state">Select a verse to create notes.</div>
        )}

        {selectedVerse ? (
          <div className="commentary-section">
            <div className="section-title">Backlinks to this verse</div>
            {isLoadingBacklinks ? (
              <div className="loading-state">Loading backlinks…</div>
            ) : backlinks?.length ? (
              <div className="commentary-list">
                {backlinks.map((b) => (
                  <div
                    key={b.note_id}
                    className="commentary-item"
                    onClick={() => {
                      try {
                        window.dispatchEvent(new CustomEvent("open-verse", { detail: { book: b.source_book, chapter: b.source_chapter, verse: b.source_verse } }));
                      } catch {}
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
            ) : (
              <div className="empty-state">No backlinks found for this verse.</div>
            )}
          </div>
        ) : null}

        {isAuthenticated ? (
          <form className="notes-form" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Note title"
              value={title}
              onChange={event => setTitle(event.target.value)}
            />
            <textarea
              placeholder="Markdown content"
              value={content}
              onChange={event => setContent(event.target.value)}
              required
            />
            <div className="notes-form-row">
              <label>
                <input
                  type="checkbox"
                  checked={isPublic}
                  onChange={event => setIsPublic(event.target.checked)}
                />
                Public
              </label>
              <select
                value={endVerseId || ""}
                onChange={event => setEndVerseId(event.target.value || null)}
              >
                <option value="">Single verse</option>
                {verseOptions.map(option => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={tags}
              onChange={e => setTags(e.target.value)}
            />
            <button type="submit" disabled={!selectedVerse}>
              Create note
            </button>
          </form>
        ) : (
          <div className="empty-state">Login to create notes.</div>
        )}

        {noteError ? <div className="error-text">{noteError}</div> : null}

        {isLoading ? (
          <div className="loading-state">Loading notes...</div>
        ) : (activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes).length ? (
          <div className="notes-list">
            {(
              activeTag ? notes.filter(n => Array.isArray(n.tags) && n.tags.includes(activeTag)) : notes
            ).map(note => (
              <div key={note.id} className="note-card">
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
  isLoadingBacklinks: PropTypes.bool
};

export default NotesPane;
