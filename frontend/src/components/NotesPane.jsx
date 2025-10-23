import PropTypes from "prop-types";
import { useMemo, useState } from "react";

function formatReference(note) {
  if (!note) {
    return "";
  }
  const start = `${note.start_book} ${note.start_chapter}:${note.start_verse}`;
  const end = `${note.end_book} ${note.end_chapter}:${note.end_verse}`;
  return start === end ? start : `${start} – ${end}`;
}

function NotesPane({
  notes,
  selectedVerse = null,
  onCreateNote,
  verses,
  noteError = "",
  isLoading = false,
  isAuthenticated = false,
  currentUser = null
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [endVerseId, setEndVerseId] = useState(null);

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
  verses: PropTypes.array.isRequired,
  noteError: PropTypes.string,
  isLoading: PropTypes.bool,
  isAuthenticated: PropTypes.bool,
  currentUser: PropTypes.shape({
    id: PropTypes.number.isRequired
  })
};

export default NotesPane;
