import PropTypes from "prop-types";

function ProfilePage({ profile }) {
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
      <div className="profile-notes">
        {profile.notes.length ? (
          profile.notes.map(note => (
            <article key={note.id} className="profile-note">
              <header className="profile-note-header">
                <h2>{note.title || "Untitled"}</h2>
                <span className="note-meta">
                  {note.start_book} {note.start_chapter}:{note.start_verse}
                </span>
              </header>
              <div className="profile-note-body" dangerouslySetInnerHTML={{ __html: note.content_html }} />
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
  })
};

ProfilePage.defaultProps = {
  profile: null
};

export default ProfilePage;
