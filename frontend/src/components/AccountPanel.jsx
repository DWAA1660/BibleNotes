import { useMemo, useState } from "react";
import PropTypes from "prop-types";

function AccountPanel({
  onLogout,
  error,
  tab,
  onTabChange,
  myNotes,
  isLoadingMyNotes,
  onUpdateNote,
  searchTerm,
  onSearchChange,
  authorResults,
  onSelectAuthor,
  selectedAuthor,
  isLoadingAuthors,
  isLoadingAuthorNotes
}) {
  const [editingId, setEditingId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  const currentDraft = useMemo(() => {
    if (!editingId) {
      return null;
    }
    return drafts[editingId] || null;
  }, [drafts, editingId]);

  const handleBeginEdit = note => {
    setDrafts(prev => ({
      ...prev,
      [note.id]: {
        title: note.title || "",
        content: note.content_markdown,
        isPublic: note.is_public
      }
    }));
    setEditingId(note.id);
  };

  const handleDraftChange = (field, value) => {
    if (!editingId) {
      return;
    }
    setDrafts(prev => ({
      ...prev,
      [editingId]: {
        ...prev[editingId],
        [field]: value
      }
    }));
  };

  const handleSave = async noteId => {
    const draft = drafts[noteId];
    if (!draft) {
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateNote(noteId, {
        title: draft.title,
        content_markdown: draft.content,
        is_public: draft.isPublic
      });
      setEditingId(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
  };

  const renderMyNotes = () => {
    if (isLoadingMyNotes) {
      return <div className="loading-state">Loading your notes...</div>;
    }
    if (!myNotes.length) {
      return <div className="empty-state">No notes yet.</div>;
    }
    return (
      <ul className="note-list">
        {myNotes.map(note => (
          <li key={note.id} className="note-list-item">
            {editingId === note.id && currentDraft ? (
              <div className="note-editor">
                <label htmlFor={`note-title-${note.id}`}>Title</label>
                <input
                  id={`note-title-${note.id}`}
                  type="text"
                  value={currentDraft.title}
                  onChange={event => handleDraftChange("title", event.target.value)}
                  disabled={isSaving}
                />
                <label htmlFor={`note-content-${note.id}`}>Content</label>
                <textarea
                  id={`note-content-${note.id}`}
                  rows={6}
                  value={currentDraft.content}
                  onChange={event => handleDraftChange("content", event.target.value)}
                  disabled={isSaving}
                />
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={currentDraft.isPublic}
                    onChange={event => handleDraftChange("isPublic", event.target.checked)}
                    disabled={isSaving}
                  />
                  Public
                </label>
                <div className="note-editor-actions">
                  <button type="button" onClick={() => handleSave(note.id)} disabled={isSaving}>
                    Save
                  </button>
                  <button type="button" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="note-summary">
                <div className="note-header">
                  <h4>{note.title || "Untitled"}</h4>
                  <div className="note-meta">
                    <span>{note.start_book} {note.start_chapter}:{note.start_verse}</span>
                    {note.is_public ? <span className="tag">Public</span> : <span className="tag">Private</span>}
                  </div>
                </div>
                <div className="note-actions">
                  <button type="button" onClick={() => handleBeginEdit(note)}>
                    Edit
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    );
  };

  const renderSearch = () => (
    <div className="account-search">
      <label htmlFor="user-search-input">Search users</label>
      <input
        id="user-search-input"
        type="search"
        value={searchTerm}
        onChange={event => onSearchChange(event.target.value)}
      />
      {isLoadingAuthors ? (
        <div className="loading-state">Searching...</div>
      ) : (
        <ul className="author-results">
          {authorResults.map(author => (
            <li key={author.author_id}>
              <button type="button" onClick={() => onSelectAuthor(author.author_id)}>
                {author.author_display_name || "Unknown"} ({author.public_note_count})
              </button>
            </li>
          ))}
        </ul>
      )}
      {selectedAuthor ? (
        <div className="author-notes">
          <h4>{selectedAuthor.author_display_name || "Unknown"}</h4>
          {isLoadingAuthorNotes ? (
            <div className="loading-state">Loading notes...</div>
          ) : selectedAuthor.notes.length ? (
            <ul className="note-list">
              {selectedAuthor.notes.map(note => (
                <li key={note.id} className="note-list-item">
                  <div className="note-summary">
                    <div className="note-header">
                      <h5>{note.title || "Untitled"}</h5>
                      <div className="note-meta">
                        <span>{note.start_book} {note.start_chapter}:{note.start_verse}</span>
                        {note.is_public ? <span className="tag">Public</span> : <span className="tag">Private</span>}
                      </div>
                    </div>
                    <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">No notes to display.</div>
          )}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="account-panel-content">
      <div className="account-panel-header">
        <div className="account-tabs">
          <button
            type="button"
            className={tab === "me" ? "active" : ""}
            onClick={() => onTabChange("me")}
          >
            My Notes
          </button>
          <button
            type="button"
            className={tab === "search" ? "active" : ""}
            onClick={() => onTabChange("search")}
          >
            Search Users
          </button>
        </div>
        <button type="button" onClick={onLogout}>
          Logout
        </button>
      </div>
      {error ? <div className="error-text">{error}</div> : null}
      <div className="account-panel-body">
        {tab === "me" ? renderMyNotes() : renderSearch()}
      </div>
    </div>
  );
}

AccountPanel.propTypes = {
  onLogout: PropTypes.func.isRequired,
  error: PropTypes.string,
  tab: PropTypes.oneOf(["me", "search"]).isRequired,
  onTabChange: PropTypes.func.isRequired,
  myNotes: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.number.isRequired,
      title: PropTypes.string,
      content_markdown: PropTypes.string.isRequired,
      content_html: PropTypes.string.isRequired,
      start_book: PropTypes.string.isRequired,
      start_chapter: PropTypes.number.isRequired,
      start_verse: PropTypes.number.isRequired,
      is_public: PropTypes.bool.isRequired
    })
  ).isRequired,
  isLoadingMyNotes: PropTypes.bool.isRequired,
  onUpdateNote: PropTypes.func.isRequired,
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  authorResults: PropTypes.arrayOf(
    PropTypes.shape({
      author_id: PropTypes.number.isRequired,
      author_display_name: PropTypes.string,
      public_note_count: PropTypes.number.isRequired
    })
  ).isRequired,
  onSelectAuthor: PropTypes.func.isRequired,
  selectedAuthor: PropTypes.shape({
    author_id: PropTypes.number.isRequired,
    author_display_name: PropTypes.string,
    notes: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        title: PropTypes.string,
        content_html: PropTypes.string.isRequired,
        start_book: PropTypes.string.isRequired,
        start_chapter: PropTypes.number.isRequired,
        start_verse: PropTypes.number.isRequired,
        is_public: PropTypes.bool.isRequired
      })
    ).isRequired
  }),
  isLoadingAuthors: PropTypes.bool.isRequired,
  isLoadingAuthorNotes: PropTypes.bool.isRequired
};

AccountPanel.defaultProps = {
  error: "",
  selectedAuthor: null
};

export default AccountPanel;
