import PropTypes from "prop-types";
import { useMemo } from "react";

function formatRange(note) {
  const start = `${note.start_book} ${note.start_chapter}:${note.start_verse}`;
  const end = `${note.end_book} ${note.end_chapter}:${note.end_verse}`;
  return start === end ? start : `${start} – ${end}`;
}

function SubscriptionsPane({
  subscriptions,
  publicAuthors,
  authorNotes,
  authorScope,
  onScopeChange,
  selectedAuthorId,
  onSelectAuthor,
  onSubscribe,
  onUnsubscribe,
  onNoteClick,
  isAuthenticated,
  isLoading,
  searchTerm,
  onSearchChange,
  chapterLabel
}) {
  const subscriptionIds = useMemo(
    () => new Set(subscriptions.map(subscription => subscription.author_id)),
    [subscriptions]
  );

  const filteredPublicAuthors = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return publicAuthors.filter(author => {
      if (subscriptionIds.has(author.author_id)) {
        return false;
      }
      if (!term) {
        return true;
      }
      return author.author_display_name?.toLowerCase().includes(term) ?? false;
    });
  }, [publicAuthors, subscriptionIds, searchTerm]);

  const selectedAuthor = useMemo(
    () => authorNotes.find(author => author.author_id === selectedAuthorId) || null,
    [authorNotes, selectedAuthorId]
  );

  return (
    <div className="pane">
      <div className="pane-header">Subscribed Authors</div>
      <div className="pane-content subscriptions-content">
        {isAuthenticated ? (
          <div className="subscriptions-auth">
            <div className="subscriptions-list">
              <div className="section-title">My Subscriptions</div>
              {subscriptions.length ? (
                <div className="author-list">
                  {subscriptions.map(subscription => (
                    <button
                      key={subscription.author_id}
                      type="button"
                      className={`author-chip${subscription.author_id === selectedAuthorId ? " active" : ""}`}
                      onClick={() => onSelectAuthor(subscription.author_id)}
                    >
                      <span>{subscription.author_display_name}</span>
                      <span className="chip-actions">
                        <span className="chip-scope">{subscription.author_id === selectedAuthorId ? authorScope === "chapter" ? chapterLabel : "All notes" : ""}</span>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={event => {
                            event.stopPropagation();
                            onUnsubscribe(subscription.author_id);
                          }}
                          onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              onUnsubscribe(subscription.author_id);
                            }
                          }}
                          className="chip-remove"
                        >
                          ×
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-state">Subscribe to an author to follow their notes.</div>
              )}
            </div>
            <div className="subscriptions-scope">
              <div className="scope-label">Showing {chapterLabel}</div>
              <div className="scope-toggle">
                <button
                  type="button"
                  className={authorScope === "chapter" ? "active" : ""}
                  onClick={() => onScopeChange("chapter")}
                  disabled={authorScope === "chapter"}
                >
                  This Chapter
                </button>
                <button
                  type="button"
                  className={authorScope === "all" ? "active" : ""}
                  onClick={() => onScopeChange("all")}
                  disabled={authorScope === "all"}
                >
                  All Notes
                </button>
              </div>
            </div>
            <div className="subscriptions-notes">
              <div className="section-title">Author Notes</div>
              {isLoading ? (
                <div className="loading-state">Loading notes…</div>
              ) : !selectedAuthor ? (
                <div className="empty-state">Select an author to view their notes.</div>
              ) : selectedAuthor.notes.length ? (
                <div className="author-notes-list">
                  {selectedAuthor.notes.map(note => (
                    <div key={note.id} className="author-note-card">
                      <div className="author-note-header">
                        <div>
                          <div className="author-note-title">{note.title || "Untitled"}</div>
                          <div className="note-meta">{formatRange(note)}</div>
                          <div className="note-meta">Updated {new Date(note.updated_at).toLocaleString()}</div>
                        </div>
                        <button type="button" onClick={() => onNoteClick(note)}>
                          Go to verse
                        </button>
                      </div>
                      <div className="note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">No notes available for this view.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-state">Login to subscribe to note authors.</div>
        )}
        <div className="divider" />
        <div className="discover-authors">
          <div className="section-title">Discover Authors</div>
          <input
            type="search"
            value={searchTerm}
            onChange={event => onSearchChange(event.target.value)}
            placeholder="Search authors"
            className="search-input"
          />
          {filteredPublicAuthors.length ? (
            <div className="author-list">
              {filteredPublicAuthors.map(author => (
                <div key={author.author_id} className="author-result">
                  <div>
                    <div className="author-name">{author.author_display_name}</div>
                    <div className="note-meta">{author.public_note_count} public notes</div>
                  </div>
                  <button type="button" onClick={() => onSubscribe(author.author_id)}>
                    Subscribe
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No authors match your search.</div>
          )}
        </div>
      </div>
    </div>
  );
}

SubscriptionsPane.propTypes = {
  subscriptions: PropTypes.arrayOf(
    PropTypes.shape({
      author_id: PropTypes.number.isRequired,
      author_display_name: PropTypes.string
    })
  ).isRequired,
  publicAuthors: PropTypes.arrayOf(
    PropTypes.shape({
      author_id: PropTypes.number.isRequired,
      author_display_name: PropTypes.string,
      public_note_count: PropTypes.number.isRequired
    })
  ).isRequired,
  authorNotes: PropTypes.arrayOf(
    PropTypes.shape({
      author_id: PropTypes.number.isRequired,
      author_display_name: PropTypes.string,
      notes: PropTypes.arrayOf(
        PropTypes.shape({
          id: PropTypes.number.isRequired,
          title: PropTypes.string,
          content_html: PropTypes.string.isRequired,
          updated_at: PropTypes.string.isRequired,
          start_book: PropTypes.string.isRequired,
          start_chapter: PropTypes.number.isRequired,
          start_verse: PropTypes.number.isRequired,
          end_book: PropTypes.string.isRequired,
          end_chapter: PropTypes.number.isRequired,
          end_verse: PropTypes.number.isRequired
        })
      ).isRequired
    })
  ).isRequired,
  authorScope: PropTypes.oneOf(["chapter", "all"]).isRequired,
  onScopeChange: PropTypes.func.isRequired,
  selectedAuthorId: PropTypes.number,
  onSelectAuthor: PropTypes.func.isRequired,
  onSubscribe: PropTypes.func.isRequired,
  onUnsubscribe: PropTypes.func.isRequired,
  onNoteClick: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool,
  isLoading: PropTypes.bool,
  searchTerm: PropTypes.string.isRequired,
  onSearchChange: PropTypes.func.isRequired,
  chapterLabel: PropTypes.string.isRequired
};

SubscriptionsPane.defaultProps = {
  selectedAuthorId: null,
  isAuthenticated: false,
  isLoading: false
};

export default SubscriptionsPane;
