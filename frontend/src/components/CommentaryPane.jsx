import PropTypes from "prop-types";

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
  isLoading
}) {
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
        </div>
      </div>
      <div className="pane-content">
        <div className="commentary-section">
          <div className="section-title">My Subscriptions</div>
          {isAuthenticated ? (
            authors.length ? (
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select
                  value={selectedAuthorId || ""}
                  onChange={event => onSelectAuthor(Number(event.target.value))}
                >
                  <option value="" disabled>
                    Select a commentator
                  </option>
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
            ) : (
              <div className="empty-state">No subscriptions yet.</div>
            )
          ) : (
            <div className="empty-state">Login to view your subscriptions.</div>
          )}
        </div>

        <div className="commentary-section">
          <div className="section-title">Selected Commentator</div>
          {isLoading ? (
            <div className="loading-state">Loading notes…</div>
          ) : authorNotes.length ? (
            <div className="entries-list">
              {authorNotes.map(note => (
                <div key={note.id} className="entry-card">
                  <div className="note-meta">{formatReference(note)} · Updated {new Date(note.updated_at).toLocaleString()}</div>
                  <div className="note-title" style={{ fontWeight: 600 }}>{note.title || "Untitled"}</div>
                  <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                </div>
              ))}
            </div>
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
  isLoading: PropTypes.bool
};

CommentaryPane.defaultProps = {
  activeTab: "commentaries",
  onChangeTab: () => {},
  isAuthenticated: false,
  selectedAuthorId: null,
  isLoading: false
};

export default CommentaryPane;
