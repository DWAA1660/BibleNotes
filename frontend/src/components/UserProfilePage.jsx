import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PropTypes from "prop-types";
import { api } from "../api";

function formatReference(note) {
  if (!note) return "";
  const start = `${note.start_book} ${note.start_chapter}:${note.start_verse}`;
  const end = `${note.end_book} ${note.end_chapter}:${note.end_verse}`;
  const range = start === end ? start : `${start} – ${end}`;
  return note.version_code ? `${range} · ${note.version_code}` : range;
}

function parseCanonId(canonicalId) {
  if (!canonicalId) return null;
  const parts = canonicalId.split("|");
  if (parts.length !== 3) return null;
  const [book, chapterStr, verseStr] = parts;
  const chapter = Number(chapterStr);
  const verse = Number(verseStr);
  if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
  return { book, chapter, verse };
}

function parseVerseLine(line) {
  if (!line) return null;
  const match = /^\s*(\d+):(\d+)\s*(.*)$/.exec(line);
  if (!match) return null;
  const chapter = Number(match[1]);
  const verse = Number(match[2]);
  if (!Number.isFinite(chapter) || !Number.isFinite(verse)) return null;
  return { chapter, verse, text: match[3] || "" };
}

function UserProfilePage({ onSelectAsCommentator, isAuthenticated, subscriptions, onSubscribeAuthor, onUnsubscribeAuthor }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const authorId = Number(id);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [notes, setNotes] = useState([]);
  const [followList, setFollowList] = useState([]);

  useEffect(() => {
    let cancelled = false;
    async function loadSubs() {
      try {
        const data = await api.fetchUserSubscriptions(authorId);
        if (!cancelled) setFollowList(data.subscriptions || []);
      } catch {
        if (!cancelled) setFollowList([]);
      }
    }
    if (Number.isFinite(authorId)) loadSubs();
    return () => { cancelled = true; };
  }, [authorId]);

  // filters
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verse, setVerse] = useState("");
  const [text, setText] = useState("");

  const openVerse = (book, chapter, verseNumber, version) => {
    if (!book || !Number.isFinite(chapter) || !Number.isFinite(verseNumber)) return;
    try {
      window.dispatchEvent(new CustomEvent("open-verse", { detail: { book, chapter, verse: verseNumber, version } }));
    } catch {}
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setIsLoading(true);
      setError("");
      try {
        // If logged in and viewing own profile, use /users/me/profile for complete data
        try {
          const me = await api.fetchMe();
          if (me && Number(me.id) === Number(authorId)) {
            const profile = await api.fetchMyProfile();
            if (!cancelled) {
              setAuthorName(profile.display_name || profile.email);
              setNotes(profile.notes || []);
              return;
            }
          }
        } catch {}

        // Fallback: public (and own private if authorized) via author notes endpoint
        const data = await api.fetchAuthorNotes(authorId);
        if (!cancelled) {
          setAuthorName(data.author_display_name || `User ${authorId}`);
          setNotes(data.notes || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load user");
          setNotes([]);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    if (Number.isFinite(authorId)) load();
    return () => {
      cancelled = true;
    };
  }, [authorId, isAuthenticated]);

  const subscribed = useMemo(() => {
    return subscriptions?.some(s => s.author_id === authorId);
  }, [subscriptions, authorId]);

  const filtered = useMemo(() => {
    return notes.filter(n => {
      if (book && n.start_book.toLowerCase() !== book.toLowerCase()) return false;
      if (chapter && String(n.start_chapter) !== String(chapter)) return false;
      if (verse && String(n.start_verse) !== String(verse)) return false;
      if (text) {
        const t = text.toLowerCase();
        const hay = `${n.title || ""} ${n.content_html || ""}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
  }, [notes, book, chapter, verse, text]);

  const uniqueBooks = useMemo(() => Array.from(new Set(notes.map(n => n.start_book))), [notes]);

  return (
    <div className="profile-page">
      <div className="profile-header" style={{ alignItems: "center", gap: "1rem" }}>
        <div className="profile-meta">
          <h1>{authorName}</h1>
          <span className="profile-count">Notes: {notes.length}</span>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem" }}>
          {isAuthenticated ? (
            <>
              {subscribed ? (
                <button type="button" onClick={() => onUnsubscribeAuthor(authorId)}>Unsubscribe</button>
              ) : (
                <button type="button" onClick={() => onSubscribeAuthor(authorId)}>Subscribe</button>
              )}
              <button type="button" onClick={() => onSelectAsCommentator(authorId)}>
                Select as commentator
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="commentary-section" style={{ marginTop: "1rem" }}>
        <div className="section-title">Subscriptions</div>
        {followList.length ? (
          <ul className="commentary-list">
            {followList.map(s => {
              const isSub = subscriptions?.some(a => a.author_id === s.author_id);
              return (
                <li key={s.author_id} className="commentary-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <span>{s.author_display_name}</span>
                  <span style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => navigate(`/users/${s.author_id}`)}>View</button>
                    {isAuthenticated ? (
                      isSub ? (
                        <button type="button" onClick={() => onUnsubscribeAuthor(s.author_id)}>Unsubscribe</button>
                      ) : (
                        <button type="button" onClick={() => onSubscribeAuthor(s.author_id)}>Subscribe</button>
                      )
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="empty-state">No subscriptions.</div>
        )}
      </div>

      <div className="filters" style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        <input
          list="books-list"
          placeholder="Book"
          value={book}
          onChange={e => setBook(e.target.value)}
          style={{ width: "12rem" }}
        />
        <datalist id="books-list">
          {uniqueBooks.map(b => (
            <option key={b} value={b} />
          ))}
        </datalist>
        <input
          type="number"
          min="1"
          placeholder="Chapter"
          value={chapter}
          onChange={e => setChapter(e.target.value)}
          style={{ width: "8rem" }}
        />
        <input
          type="number"
          min="1"
          placeholder="Verse"
          value={verse}
          onChange={e => setVerse(e.target.value)}
          style={{ width: "8rem" }}
        />
        <input
          type="search"
          placeholder="Search text"
          value={text}
          onChange={e => setText(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="loading-state">Loading…</div>
      ) : error ? (
        <div className="error-text">{error}</div>
      ) : filtered.length ? (
        <div className="profile-notes">
          {filtered.map(note => (
            <article key={note.id} className="profile-note">
              <header className="profile-note-header">
                <h2>{note.title || "Untitled"}</h2>
                <span className="note-meta">
                  <button
                    type="button"
                    className="note-link"
                    onClick={() => openVerse(note.start_book, note.start_chapter, note.start_verse, note.version_code)}
                    aria-label={`Go to ${formatReference(note)}`}
                  >
                    {formatReference(note)}
                  </button>
                </span>
              </header>
              <div className="profile-note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
              {note.cross_references && note.cross_references.length ? (
                <div className="note-meta">
                  References:{" "}
                  {note.cross_references.map((canonicalId, idx) => {
                    const parsed = parseCanonId(canonicalId);
                    const label = parsed ? `${parsed.book} ${parsed.chapter}:${parsed.verse}` : canonicalId;
                    return (
                      <span key={`${canonicalId}-${idx}`}>
                        {idx > 0 ? ", " : ""}
                        {parsed ? (
                          <button
                            type="button"
                            className="note-link"
                            onClick={() => openVerse(parsed.book, parsed.chapter, parsed.verse, note.version_code)}
                          >
                            {label}
                          </button>
                        ) : label}
                      </span>
                    );
                  })}
                </div>
              ) : null}
              {note.verses_text && note.verses_text.length ? (
                <div className="verse-box">
                  {note.verses_text.map((line, idx) => {
                    const parsed = parseVerseLine(line);
                    return (
                      <div key={idx} className="note-meta">
                        {parsed ? (
                          <>
                            <button
                              type="button"
                              className="note-link"
                              onClick={() => openVerse(note.start_book, parsed.chapter, parsed.verse, note.version_code)}
                            >
                              {`${note.start_book} ${parsed.chapter}:${parsed.verse}`}
                            </button>
                            {parsed.text ? <span>{` ${parsed.text}`}</span> : null}
                          </>
                        ) : (
                          line
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">No notes match your filters.</div>
      )}
    </div>
  );
}

UserProfilePage.propTypes = {
  onSelectAsCommentator: PropTypes.func.isRequired,
  isAuthenticated: PropTypes.bool,
  subscriptions: PropTypes.array,
  onSubscribeAuthor: PropTypes.func.isRequired,
  onUnsubscribeAuthor: PropTypes.func.isRequired
};

UserProfilePage.defaultProps = {
  isAuthenticated: false,
  subscriptions: []
};

export default UserProfilePage;
