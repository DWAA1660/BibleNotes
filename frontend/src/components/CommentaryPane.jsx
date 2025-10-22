import PropTypes from "prop-types";
import { useEffect, useState } from "react";

function CommentaryPane({
  publicCommentaries,
  subscriptions,
  selectedCommentaryId,
  onSelectCommentary,
  onSubscribe,
  commentaryEntries,
  onSearch,
  searchTerm,
  isAuthenticated,
  isLoading
}) {
  const [localSearch, setLocalSearch] = useState(searchTerm);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  const handleSearchSubmit = event => {
    event.preventDefault();
    onSearch(localSearch);
  };

  return (
    <div className="pane">
      <div className="pane-header">Commentaries</div>
      <div className="pane-content">
        <form onSubmit={handleSearchSubmit} className="commentary-section">
          <input
            type="search"
            className="search-input"
            placeholder="Search public commentaries"
            value={localSearch}
            onChange={event => setLocalSearch(event.target.value)}
          />
        </form>

        <div className="commentary-section">
          <div className="section-title">My Subscriptions</div>
          {subscriptions.length ? (
            <div className="subscription-list">
              {subscriptions.map(sub => (
                <div
                  key={sub.commentary_id}
                  className={`commentary-item${sub.commentary_id === selectedCommentaryId ? " active" : ""}`}
                  onClick={() => onSelectCommentary(sub.commentary_id)}
                >
                  <div>{sub.commentary_title}</div>
                  <div className="note-meta">By {sub.owner_display_name || "Unknown"}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No subscriptions yet.</div>
          )}
        </div>

        <div className="commentary-section">
          <div className="section-title">Public Commentaries</div>
          {isLoading ? (
            <div className="loading-state">Searching...</div>
          ) : publicCommentaries.length ? (
            <div className="commentary-list">
              {publicCommentaries.map(commentary => (
                <div
                  key={commentary.id}
                  className={`commentary-item${commentary.id === selectedCommentaryId ? " active" : ""}`}
                >
                  <div>{commentary.title}</div>
                  <div className="note-meta">By {commentary.owner_display_name || "Unknown"}</div>
                  {isAuthenticated ? (
                    <button type="button" onClick={() => onSubscribe(commentary.id)}>
                      Subscribe
                    </button>
                  ) : null}
                  <button type="button" onClick={() => onSelectCommentary(commentary.id)}>
                    View
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No public commentaries found.</div>
          )}
        </div>

        <div className="commentary-section">
          <div className="section-title">Selected Commentary</div>
          {commentaryEntries.length ? (
            <div className="entries-list">
              {commentaryEntries.map(entry => (
                <div key={entry.id} className="entry-card">
                  <div className="note-meta">
                    Verse ID: {entry.verse_id} · {new Date(entry.updated_at).toLocaleString()}
                  </div>
                  <div dangerouslySetInnerHTML={{ __html: entry.content_html }} />
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Select a commentary to view entries.</div>
          )}
        </div>
      </div>
    </div>
  );
}

CommentaryPane.propTypes = {
  publicCommentaries: PropTypes.array.isRequired,
  subscriptions: PropTypes.array.isRequired,
  selectedCommentaryId: PropTypes.number,
  onSelectCommentary: PropTypes.func.isRequired,
  onSubscribe: PropTypes.func.isRequired,
  commentaryEntries: PropTypes.array.isRequired,
  onSearch: PropTypes.func.isRequired,
  searchTerm: PropTypes.string.isRequired,
  isAuthenticated: PropTypes.bool,
  isLoading: PropTypes.bool
};

CommentaryPane.defaultProps = {
  selectedCommentaryId: null,
  isAuthenticated: false,
  isLoading: false
};

export default CommentaryPane;
