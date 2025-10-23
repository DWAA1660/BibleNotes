import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { api } from "../api";

function SearchPage({ query, onSubscribeAuthor, onUnsubscribeAuthor, onOpenAuthor, isAuthenticated, subscriptions }) {
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setIsLoading(true);
      setError("");
      try {
        const resp = await api.searchUsers(query);
        if (!cancelled) {
          setUsers(resp.users || []);
        }
      } catch (e) {
        if (!cancelled) {
          setUsers([]);
          setError(e.message || "Search failed");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="profile-container">
      <h2>Search Results</h2>
      {query ? <div className="note-meta">Query: {query}</div> : <div className="note-meta">Showing all users</div>}
      {isLoading ? (
        <div className="loading-state">Searching…</div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : users.length ? (
        <div className="commentary-list">
          {users.map(u => {
            const isSub = subscriptions?.some(s => s.author_id === u.id);
            return (
              <div key={u.id} className="commentary-item">
                <div>{u.display_name || u.email}</div>
                <div className="note-meta">{u.email}</div>
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
                  {isAuthenticated ? (
                    isSub ? (
                      <button type="button" onClick={() => onUnsubscribeAuthor(u.id)}>Unsubscribe</button>
                    ) : (
                      <button type="button" onClick={() => onSubscribeAuthor(u.id)}>Subscribe</button>
                    )
                  ) : null}
                  <button type="button" onClick={() => onOpenAuthor(u.id)}>View</button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state">No users match your search.</div>
      )}
    </div>
  );
}

SearchPage.propTypes = {
  query: PropTypes.string.isRequired,
  onSubscribeAuthor: PropTypes.func.isRequired,
  onUnsubscribeAuthor: PropTypes.func.isRequired,
  onOpenAuthor: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool,
  subscriptions: PropTypes.array
};

SearchPage.defaultProps = {
  isAuthenticated: false,
  subscriptions: []
};

export default SearchPage;
