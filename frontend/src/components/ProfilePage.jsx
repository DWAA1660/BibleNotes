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

function ProfilePage({ profile, isOwnProfile, onUpdateNote, subscriptions, onUnsubscribeAuthor }) {
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editIsPublic, setEditIsPublic] = useState(false);
  const [editEndVerseId, setEditEndVerseId] = useState(null);
  const [editEndOptions, setEditEndOptions] = useState([]);

  const beginEdit = async note => {
    setEditingId(note.id);
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
    setEditingId(null);
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
  if (!profile) {
    return (
      <div className="profile-page">
        <div className="empty-state">No profile data.</div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <img src={profile.avatar_url} alt={profile.display_name || profile.email} className="profile-avatar" />
        <div className="profile-meta">
          <h1>{profile.display_name || profile.email}</h1>
          <p>{profile.email}</p>
          <span className="profile-count">Notes: {profile.note_count}</span>
        </div>
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
        {profile.notes.length ? (
          profile.notes.map(note => (
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
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <button type="submit">Save</button>
                    <button type="button" onClick={cancelEdit}>Cancel</button>
                  </div>
                </form>
              ) : (
                <>
                  <header className="profile-note-header">
                    <h2>{note.title || "Untitled"}</h2>
                    <span className="note-meta">{formatReference(note)}</span>
                  </header>
                  <div className="profile-note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
                  {note.verses_text && note.verses_text.length ? (
                    <div className="verse-box">
                      {note.verses_text.map((line, idx) => (
                        <div key={idx} className="note-meta">{line}</div>
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
