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

  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editEndVerseId, setEditEndVerseId] = useState(null);
  const [editEndOptions, setEditEndOptions] = useState([]);

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

  const handleSubmit = event => {
    event.preventDefault();
    if (!selectedVerse) {
      return;
    }
    onCreateNote({
      title,
      content,
      isPublic,
      endVerseId: endVerseId ? Number(endVerseId) : undefined
    });
    setTitle("");
    setContent("");
    setIsPublic(false);
    setEndVerseId(null);
  };

  // Backlinks in chapter payload are note metadata (not verse references)
  // Format as "Title · by Author" and optionally indicate privacy

  const beginEdit = async note => {
    setEditingNoteId(note.id);
    setEditTitle(note.title || "");
    setEditContent(note.content_markdown || "");
    setEditIsPublic(Boolean(note.is_public));
    setEditEndVerseId(note.end_verse_id);
    try {
      const chapter = await api.fetchChapter(note.version_code, note.start_book, note.start_chapter);
      const startIdx = chapter.verses.findIndex(v => v.id === note.start_verse_id);
      const options = (startIdx >= 0 ? chapter.verses.slice(startIdx) : chapter.verses).map(v => ({ id: v.id, label: `${v.chapter}:${v.verse}` }));
      setEditEndOptions(options);
    } catch {
      setEditEndOptions([]);
    }
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditTitle("");
    setEditContent("");
    setEditIsPublic(false);
    setEditEndVerseId(null);
    setEditEndOptions([]);
  };

  const saveEdit = async original => {
    const payload = {};
    if ((editTitle || "") !== (original.title || "")) payload.title = editTitle;
    if ((editContent || "") !== (original.content_markdown || "")) payload.content_markdown = editContent;
    if (Boolean(editIsPublic) !== Boolean(original.is_public)) payload.is_public = editIsPublic;
    if (Number(editEndVerseId) !== Number(original.end_verse_id)) payload.end_verse_id = Number(editEndVerseId);
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
        ) : notes.length ? (
          <div className="notes-list">
            {notes.map(note => (
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
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <button type="submit">Save</button>
                      <button type="button" onClick={cancelEdit}>Cancel</button>
                    </div>
                  </form>
                ) : (
                  <>
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
