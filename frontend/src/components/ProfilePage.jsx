// Private Profile Page (current logged-in user)
// - Shows the authenticated user's own notes (private + public).
// - Allows inline editing of notes (title, content, privacy, range, tags).
// - Provides client-side filters: Tag, Book, Chapter, Verse, free-text search.
// - Differs from UserProfilePage (public author view): this page includes subscriptions
//   management and always operates on the viewer's own data.
import PropTypes from "prop-types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
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

function ProfilePage({ profile, isOwnProfile, onUpdateNote, subscriptions, onUnsubscribeAuthor }) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editEndVerseId, setEditEndVerseId] = useState(null);
  const [editEndOptions, setEditEndOptions] = useState([]);
  const [editTags, setEditTags] = useState("");
  const [activeTag, setActiveTag] = useState("");
  const [book, setBook] = useState("");
  const [chapter, setChapter] = useState("");
  const [verse, setVerse] = useState("");
  const [text, setText] = useState("");

  // Navigate to a verse in the main reading view
  const openVerse = (book, chapter, verse, version) => {
    if (!book || !Number.isFinite(chapter) || !Number.isFinite(verse)) return;
    try {
      window.dispatchEvent(new CustomEvent("open-verse", { detail: { book, chapter, verse, version } }));
    } catch {}
  };

  // Begin editing: seed all edit fields and fetch end-verse options for range
  const beginEdit = async note => {
    setEditingId(note.id);
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

  // Cancel editing and reset state
  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
    setEditIsPublic(false);
    setEditEndVerseId(null);
    setEditEndOptions([]);
    setEditTags("");
  };

  // Persist edits by calling onUpdateNote with only changed fields
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
  if (!profile) {
    return (
      <div className="profile-page">
        <div className="empty-state">No profile data.</div>
      </div>
    );
  }

  const notes = Array.isArray(profile.notes) ? profile.notes : [];
  const uniqueBooks = Array.from(new Set(notes.map(n => n.start_book)));
  const tagOptions = (() => {
    const set = new Set();
    notes.forEach(n => { if (Array.isArray(n.tags)) n.tags.forEach(t => set.add(t)); });
    return Array.from(set).sort();
  })();
  const filteredNotes = notes.filter(n => {
    if (activeTag && !(Array.isArray(n.tags) && n.tags.includes(activeTag))) return false;
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

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={profile.avatar_url || ""} alt={profile.display_name || profile.email} className="profile-avatar" />
        <div className="profile-meta">
          <h1>{profile.display_name || profile.email}</h1>
          <p>{profile.email}</p>
          <span className="profile-count">Notes: {profile.note_count}</span>
        </div>
      </div>
      <div className="filters" style={{ display: "flex", gap: "0.5rem", margin: "1rem 0", alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="tagFilter" style={{ whiteSpace: "nowrap" }}>Tag:</label>
        <select id="tagFilter" value={activeTag} onChange={e => setActiveTag(e.target.value)}>
          <option value="">All</option>
          {tagOptions.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
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
      {isOwnProfile ? (
        <div className="commentary-section" style={{ marginTop: "1rem" }}>
          <div className="section-title">My Subscriptions</div>
          {subscriptions && subscriptions.length ? (
            <ul className="commentary-list">
              {subscriptions.map(s => (
                <li key={s.author_id} className="commentary-item" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                  <span>{s.author_display_name}</span>
                  <span style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="button" onClick={() => navigate(`/users/${s.author_id}`)}>View</button>
                    <button type="button" onClick={() => onUnsubscribeAuthor(s.author_id)}>Unsubscribe</button>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty-state">You are not subscribed to anyone yet.</div>
          )}
        </div>
      ) : null}
      <div className="profile-notes">
        {activeTag ? (
          <div className="note-meta" style={{ marginBottom: "0.5rem" }}>
            Filter: <strong>{activeTag}</strong> <button type="button" onClick={() => setActiveTag("")}>×</button>
          </div>
        ) : null}
        {filteredNotes.length ? (
          filteredNotes.map(note => (
            <article key={note.id} className="profile-note">
              {editingId === note.id ? (
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
                  {Array.isArray(note.tags) && note.tags.length ? (
                    <div className="note-meta">
                      Tags: {note.tags.map((t, idx) => (
                        <span key={`${t}-${idx}`}>
                          {idx > 0 ? ", " : ""}
                          <button type="button" className="note-link" onClick={() => setActiveTag(t)}>{t}</button>
                        </span>
                      ))}
                    </div>
                  ) : null}
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
                      {note.verses_text.map((line, idx) => (
                        <div key={idx} className="note-meta">
                          {(() => {
                            const parsed = parseVerseLine(line);
                            if (!parsed) {
                              return line;
                            }
                            return (
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
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {isOwnProfile ? (
                    <div style={{ marginTop: "0.5rem" }}>
                      <button type="button" onClick={() => beginEdit(note)}>Edit</button>
                    </div>
                  ) : null}
                </>
              )}
            </article>
          ))
        ) : (
          <div className="empty-state">No notes yet.</div>
        )}
      </div>

    </div>
  );
}

ProfilePage.propTypes = {
  profile: PropTypes.shape({
    avatar_url: PropTypes.string.isRequired,
    display_name: PropTypes.string,
    email: PropTypes.string.isRequired,
    note_count: PropTypes.number.isRequired,
    notes: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        title: PropTypes.string,
        content_html: PropTypes.string.isRequired,
        start_book: PropTypes.string.isRequired,
        start_chapter: PropTypes.number.isRequired,
        start_verse: PropTypes.number.isRequired
      })
    ).isRequired
  }),
  isOwnProfile: PropTypes.bool,
  onUpdateNote: PropTypes.func,
  subscriptions: PropTypes.array,
  onUnsubscribeAuthor: PropTypes.func
};

ProfilePage.defaultProps = {
  profile: null,
  isOwnProfile: false,
  onUpdateNote: undefined,
  subscriptions: [],
  onUnsubscribeAuthor: undefined
};

export default ProfilePage;
