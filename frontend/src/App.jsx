import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, setToken } from "./api.js";
import VersionSelector from "./components/VersionSelector.jsx";
import BiblePane from "./components/BiblePane.jsx";
import NotesPane from "./components/NotesPane.jsx";
import CommentaryPane from "./components/CommentaryPane.jsx";
import ProfilePage from "./components/ProfilePage.jsx";

const BOOKS = [
  "Genesis",
  "Exodus",
  "Leviticus",
  "Numbers",
  "Deuteronomy",
  "Joshua",
  "Judges",
  "Ruth",
  "1 Samuel",
  "2 Samuel",
  "1 Kings",
  "2 Kings",
  "1 Chronicles",
  "2 Chronicles",
  "Ezra",
  "Nehemiah",
  "Esther",
  "Job",
  "Psalms",
  "Proverbs",
  "Ecclesiastes",
  "Song of Solomon",
  "Isaiah",
  "Jeremiah",
  "Lamentations",
  "Ezekiel",
  "Daniel",
  "Hosea",
  "Joel",
  "Amos",
  "Obadiah",
  "Jonah",
  "Micah",
  "Nahum",
  "Habakkuk",
  "Zephaniah",
  "Haggai",
  "Zechariah",
  "Malachi",
  "Matthew",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Romans",
  "1 Corinthians",
  "2 Corinthians",
  "Galatians",
  "Ephesians",
  "Philippians",
  "Colossians",
  "1 Thessalonians",
  "2 Thessalonians",
  "1 Timothy",
  "2 Timothy",
  "Titus",
  "Philemon",
  "Hebrews",
  "James",
  "1 Peter",
  "2 Peter",
  "1 John",
  "2 John",
  "3 John",
  "Jude",
  "Revelation"
];

function App() {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(() => localStorage.getItem("selectedVersion") || "");
  const [selectedBook, setSelectedBook] = useState(() => localStorage.getItem("selectedBook") || "Genesis");
  const [selectedChapter, setSelectedChapter] = useState(() => {
    const stored = localStorage.getItem("selectedChapter");
    return stored ? Number(stored) || 1 : 1;
  });
  const [chapterData, setChapterData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedVerseId, setSelectedVerseId] = useState(() => {
    const stored = localStorage.getItem("selectedVerseId");
    return stored ? Number(stored) || null : null;
  });
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("authToken"));
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] = useState(false);
  const [isLoadingCommentaries, setIsLoadingCommentaries] = useState(false);
  const [publicCommentaries, setPublicCommentaries] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedCommentaryId, setSelectedCommentaryId] = useState(null);
  const [commentaryEntries, setCommentaryEntries] = useState([]);
  const [commentarySearchTerm, setCommentarySearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  useEffect(() => {
    setToken(authToken);
  }, [authToken]);

  useEffect(() => {
    async function loadVersions() {
      try {
        const data = await api.fetchVersions();
        setVersions(data);
        if (data.length > 0) {
          setSelectedVersion(prev => {
            if (prev && data.some(item => item.code === prev)) {
              return prev;
            }
            return data[0].code;
          });
        }
      } catch {
        setVersions([]);
      }
    }
    loadVersions();
  }, []);

  useEffect(() => {
    if (selectedVersion) {
      localStorage.setItem("selectedVersion", selectedVersion);
    } else {
      localStorage.removeItem("selectedVersion");
    }
  }, [selectedVersion]);

  useEffect(() => {
    if (selectedBook) {
      localStorage.setItem("selectedBook", selectedBook);
    } else {
      localStorage.removeItem("selectedBook");
    }
  }, [selectedBook]);

  useEffect(() => {
    if (selectedChapter) {
      localStorage.setItem("selectedChapter", String(selectedChapter));
    } else {
      localStorage.removeItem("selectedChapter");
    }
  }, [selectedChapter]);

  useEffect(() => {
    if (selectedVerseId) {
      localStorage.setItem("selectedVerseId", String(selectedVerseId));
    } else {
      localStorage.removeItem("selectedVerseId");
    }
  }, [selectedVerseId]);

  useEffect(() => {
    if (!selectedVersion || !selectedBook || !selectedChapter) {
      return;
    }
    async function loadChapterAndNotes() {
      setIsLoadingChapter(true);
      setIsLoadingNotes(true);
      try {
        const data = await api.fetchChapter(selectedVersion, selectedBook, selectedChapter);
        setChapterData(data);
        if (data.verses.length > 0) {
          setSelectedVerseId(prev => {
            if (prev && data.verses.some(verse => verse.id === prev)) {
              return prev;
            }
            return data.verses[0].id;
          });
        }
      } catch {
        setChapterData(null);
      } finally {
        setIsLoadingChapter(false);
      }
      try {
        const noteData = await api.fetchNotes(selectedVersion, selectedBook, selectedChapter);
        setNotes(noteData.notes);
      } catch {
        setNotes([]);
      } finally {
        setIsLoadingNotes(false);
      }
    }
    loadChapterAndNotes();
  }, [selectedVersion, selectedBook, selectedChapter]);

  useEffect(() => {
    async function loadSubscriptions() {
      if (!authToken) {
        setSubscriptions([]);
        return;
      }
      try {
        const data = await api.fetchCommentarySubscriptions();
        setSubscriptions(data);
      } catch {
        setSubscriptions([]);
      }
    }
    loadSubscriptions();
  }, [authToken]);

  useEffect(() => {
    let cancelled = false;
    async function loadPublic() {
      setIsLoadingCommentaries(true);
      try {
        const data = await api.fetchPublicCommentaries(commentarySearchTerm);
        if (!cancelled) {
          setPublicCommentaries(data);
        }
      } catch {
        if (!cancelled) {
          setPublicCommentaries([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingCommentaries(false);
        }
      }
    }
    loadPublic();
    return () => {
      cancelled = true;
    };
  }, [commentarySearchTerm]);

  useEffect(() => {
    setSearchInput(commentarySearchTerm);
  }, [commentarySearchTerm]);

  useEffect(() => {
    if (location.pathname !== "/profile") {
      setProfileError("");
      return;
    }
    if (!authToken) {
      setProfileData(null);
      setProfileError("Login required");
      return;
    }
    let cancelled = false;
    setIsLoadingProfile(true);
    setProfileError("");
    (async () => {
      try {
        const data = await api.fetchMyProfile();
        if (!cancelled) {
          setProfileData(data);
        }
      } catch (error) {
        if (!cancelled) {
          setProfileError(error.message || "Failed to load profile");
          setProfileData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingProfile(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [location.pathname, authToken]);

  const selectedVerse = useMemo(() => {
    if (!chapterData) {
      return null;
    }
    return chapterData.verses.find(verse => verse.id === selectedVerseId) || null;
  }, [chapterData, selectedVerseId]);

  const handleAuthSubmit = async event => {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    const email = form.get("email");
    const password = form.get("password");
    const displayName = form.get("displayName") || undefined;
    setAuthError("");
    try {
      if (authMode === "signup") {
        const token = await api.signup({ email, password, display_name: displayName });
        setAuthToken(token.access_token);
        localStorage.setItem("authToken", token.access_token);
      } else {
        const token = await api.login({ email, password });
        setAuthToken(token.access_token);
        localStorage.setItem("authToken", token.access_token);
      }
      formEl.reset();
      setIsAuthOpen(false);
    } catch (error) {
      setAuthError(error.message || "Authentication failed");
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setToken(null);
    localStorage.removeItem("authToken");
    setSubscriptions([]);
    setProfileData(null);
    if (location.pathname === "/profile") {
      navigate("/");
    }
  };

  const handleCreateNote = async payload => {
    if (!authToken) {
      setNoteError("Login required");
      return;
    }
    if (!selectedVerse) {
      setNoteError("Select a verse first");
      return;
    }
    try {
      const end = payload.endVerseId || selectedVerseId;
      await api.createNote({
        title: payload.title,
        content_markdown: payload.content,
        version_code: selectedVersion,
        start_verse_id: selectedVerseId,
        end_verse_id: end,
        is_public: payload.isPublic
      });
      const noteData = await api.fetchNotes(selectedVersion, selectedBook, selectedChapter);
      setNotes(noteData.notes);
    } catch (error) {
      setNoteError(error.message || "Failed to create note");
    }
  };

  const handleHeaderSearchSubmit = event => {
    event.preventDefault();
    setCommentarySearchTerm(searchInput.trim());
    if (location.pathname !== "/") {
      navigate("/");
    }
  };

  const handleSearchInputChange = value => {
    setSearchInput(value);
    if (!value.trim()) {
      setCommentarySearchTerm("");
    }
  };

  const handleSubscribe = async commentaryId => {
    if (!authToken) {
      return;
    }
    try {
      const subscription = await api.subscribeCommentary(commentaryId);
      setSubscriptions(prev => {
        const exists = prev.find(item => item.commentary_id === subscription.commentary_id);
        if (exists) {
          return prev;
        }
        return [...prev, subscription];
      });
    } catch {}
  };

  const handleSelectCommentary = async commentaryId => {
    setSelectedCommentaryId(commentaryId);
    try {
      const entries = await api.fetchCommentaryEntries(commentaryId, selectedVerseId || undefined);
      setCommentaryEntries(entries.entries);
    } catch {
      setCommentaryEntries([]);
    }
  };

  return (
    <div className="layout">
      <header className="app-header">
        <div className="branding" onClick={() => navigate("/")}>Bible Notes</div>
        <form className="header-search" onSubmit={handleHeaderSearchSubmit}>
          <input
            type="search"
            placeholder="Search commentaries"
            value={searchInput}
            onChange={event => handleSearchInputChange(event.target.value)}
          />
          <button type="submit">Search</button>
        </form>
        <div className="header-actions">
          {authToken ? (
            <>
              <button type="button" onClick={() => navigate("/profile")}>Profile</button>
              <button type="button" onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button type="button" onClick={() => setIsAuthOpen(prev => !prev)}>
              {isAuthOpen ? "Close" : "Login / Signup"}
            </button>
          )}
        </div>
      </header>
      {!authToken && isAuthOpen ? (
        <form className="auth-form" onSubmit={handleAuthSubmit}>
          <select value={authMode} onChange={event => setAuthMode(event.target.value)}>
            <option value="login">Login</option>
            <option value="signup">Signup</option>
          </select>
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" required />
          {authMode === "signup" ? (
            <input name="displayName" type="text" placeholder="Display name" />
          ) : null}
          <button type="submit">Submit</button>
        </form>
      ) : null}
      {!authToken && authError ? <div className="error-text">{authError}</div> : null}
      {location.pathname === "/" ? (
        <VersionSelector
          versions={versions}
          selectedVersion={selectedVersion}
          onVersionChange={value => {
            setSelectedVersion(value);
            setSelectedVerseId(null);
          }}
          books={BOOKS}
          selectedBook={selectedBook}
          onBookChange={value => {
            setSelectedBook(value);
            setSelectedChapter(1);
            setSelectedVerseId(null);
          }}
          chapter={selectedChapter}
          onChapterChange={value => {
            setSelectedChapter(value);
            setSelectedVerseId(null);
          }}
          loadingChapter={isLoadingChapter}
        />
      ) : (
        <div className="toolbar-placeholder">
          <h2>Profile</h2>
        </div>
      )}
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <div className="panes">
                <NotesPane
                  notes={notes}
                  selectedVerse={selectedVerse}
                  onCreateNote={handleCreateNote}
                  verses={chapterData ? chapterData.verses : []}
                  noteError={noteError}
                  isLoading={isLoadingNotes}
                  isAuthenticated={Boolean(authToken)}
                />
                <BiblePane
                  chapterData={chapterData}
                  selectedVerseId={selectedVerseId}
                  onSelectVerse={setSelectedVerseId}
                  isLoading={isLoadingChapter}
                />
                <CommentaryPane
                  publicCommentaries={publicCommentaries}
                  subscriptions={subscriptions}
                  selectedCommentaryId={selectedCommentaryId}
                  onSelectCommentary={handleSelectCommentary}
                  onSubscribe={handleSubscribe}
                  commentaryEntries={commentaryEntries}
                  isAuthenticated={Boolean(authToken)}
                  isLoading={isLoadingCommentaries}
                />
              </div>
            }
          />
          <Route
            path="/profile"
            element={
              <div className="profile-container">
                {isLoadingProfile ? (
                  <div className="loading-state">Loading profile...</div>
                ) : profileError ? (
                  <div className="error-text">{profileError}</div>
                ) : (
                  <ProfilePage profile={profileData} />
                )}
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
