import { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { api, setToken } from "./api.js";
import VersionSelector from "./components/VersionSelector.jsx";
import BiblePane from "./components/BiblePane.jsx";
import NotesPane from "./components/NotesPane.jsx";
import CommentaryPane from "./components/CommentaryPane.jsx";
import ManuscriptsPane from "./components/ManuscriptsPane.jsx";
import AppConcordance from "./components/AppConcordance.jsx";
import SearchPage from "./components/SearchPage.jsx";
import UserProfilePage from "./components/UserProfilePage.jsx";
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
  const [authorSubscriptions, setAuthorSubscriptions] = useState([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState(() => {
    const stored = localStorage.getItem("selectedAuthorId");
    return stored ? Number(stored) || null : null;
  });
  const [authorNotes, setAuthorNotes] = useState([]);
  const [commentarySearchTerm, setCommentarySearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const location = useLocation();
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [rightPaneTab, setRightPaneTab] = useState(() => localStorage.getItem("rightPaneTab") || "commentaries");
  const [selectionMode, setSelectionMode] = useState(() => localStorage.getItem("selectionMode") || "verse");
  const [pendingGoto, setPendingGoto] = useState(null);
  const [concordanceQuery, setConcordanceQuery] = useState("");

  useEffect(() => {
    setToken(authToken);
  }, [authToken]);

  useEffect(() => {
    if (rightPaneTab) {
      localStorage.setItem("rightPaneTab", rightPaneTab);
    } else {
      localStorage.removeItem("rightPaneTab");
    }
  }, [rightPaneTab]);

  useEffect(() => {
    if (selectionMode) {
      localStorage.setItem("selectionMode", selectionMode);
    } else {
      localStorage.removeItem("selectionMode");
    }
  }, [selectionMode]);

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

  // When a word is clicked in the Bible pane, switch to Concordance and seed query
  useEffect(() => {
    const handler = e => {
      const d = e.detail || {};
      if (d && d.token) {
        try { localStorage.setItem("lastWordSelectToken", d.token); } catch {}
        setConcordanceQuery(d.token);
        setRightPaneTab("concordance");
      }
    };
    window.addEventListener("word-select", handler);
    return () => window.removeEventListener("word-select", handler);
  }, []);

  // After chapter loads, if we have a pending go-to-verse, select and scroll to it
  useEffect(() => {
    if (!pendingGoto || !chapterData) return;
    if (chapterData.book !== pendingGoto.book || chapterData.chapter !== pendingGoto.chapter) return;
    const verseObj = chapterData.verses.find(v => v.verse === pendingGoto.verse);
    if (verseObj) {
      setSelectedVerseId(verseObj.id);
      window.dispatchEvent(new CustomEvent("goto-verse", { detail: { book: pendingGoto.book, chapter: pendingGoto.chapter, verse: pendingGoto.verse } }));
    }
    setPendingGoto(null);
  }, [pendingGoto, chapterData]);

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
        if (authToken) {
          const my = await api.fetchMyNotes();
          const filtered = my.notes.filter(n =>
            n.start_book === selectedBook &&
            n.start_chapter === selectedChapter
          );
          setNotes(filtered);
        } else {
          setNotes([]);
        }
      } catch {
        setNotes([]);
      } finally {
        setIsLoadingNotes(false);
      }
    }
    loadChapterAndNotes();
  }, [selectedVersion, selectedBook, selectedChapter, authToken]);

  useEffect(() => {
    async function loadAuthorSubscriptions() {
      if (!authToken) {
        setAuthorSubscriptions([]);
        return;
      }
      try {
        const data = await api.fetchNoteSubscriptions();
        setAuthorSubscriptions(data.subscriptions || []);
      } catch {
        setAuthorSubscriptions([]);
      }
    }
    loadAuthorSubscriptions();
  }, [authToken]);

  // Load my profile data when viewing /profile
  useEffect(() => {
    const onProfile = location.pathname === "/profile" || location.pathname === "/profile/";
    if (!onProfile) {
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

  useEffect(() => {
    if (selectedAuthorId) {
      localStorage.setItem("selectedAuthorId", String(selectedAuthorId));
    } else {
      localStorage.removeItem("selectedAuthorId");
    }
  }, [selectedAuthorId]);

  useEffect(() => {
    if (!selectedAuthorId) {
      setAuthorNotes([]);
      return;
    }
    (async () => {
      setIsLoadingCommentaries(true);
      try {
        const data = await api.fetchAuthorNotes(selectedAuthorId);
        const filtered = (data.notes || []).filter(n => n.start_book === selectedBook && n.start_chapter === selectedChapter);
        setAuthorNotes(filtered);
      } catch {
        setAuthorNotes([]);
      } finally {
        setIsLoadingCommentaries(false);
      }
    })();
  }, [selectedAuthorId, selectedBook, selectedChapter, chapterData]);

  const handleSubscribeAuthor = async authorId => {
    if (!authToken) return;
    try {
      const sub = await api.subscribeAuthor(authorId);
      setAuthorSubscriptions(prev => {
        const exists = prev.find(s => s.author_id === sub.author_id);
        return exists ? prev : [...prev, sub];
      });
    } catch {}
  };

  const handleSelectAsCommentator = async authorId => {
    await handleSubscribeAuthor(authorId);
    await handleSelectAuthor(authorId);
    navigate("/");
  };

  const handleUnsubscribeAuthor = async authorId => {
    if (!authToken) return;
    try {
      await api.unsubscribeAuthor(authorId);
      setAuthorSubscriptions(prev => prev.filter(s => s.author_id !== authorId));
    } catch {}
  };

  const handleSelectAuthor = async authorId => {
    setSelectedAuthorId(authorId || null);
    setIsLoadingCommentaries(true);
    try {
      const data = await api.fetchAuthorNotes(authorId);
      const filtered = (data.notes || []).filter(n => n.start_book === selectedBook && n.start_chapter === selectedChapter);
      setAuthorNotes(filtered);
    } catch {
      setAuthorNotes([]);
    } finally {
      setIsLoadingCommentaries(false);
    }
  };

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
    setAuthorSubscriptions([]);
    setSelectedAuthorId(null);
    setAuthorNotes([]);
    localStorage.removeItem("selectedAuthorId");
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
      if (authToken) {
        const my = await api.fetchMyNotes();
        const filtered = my.notes.filter(n =>
          n.version_code === selectedVersion &&
          n.start_book === selectedBook &&
          n.start_chapter === selectedChapter
        );
        setNotes(filtered);
      }
    } catch (error) {
      setNoteError(error.message || "Failed to create note");
    }
  };

  const handleHeaderSearchSubmit = event => {
    event.preventDefault();
    const q = searchInput.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  };

  const handleSearchInputChange = value => {
    setSearchInput(value);
    if (!value.trim()) {
      setCommentarySearchTerm("");
    }
  };

  return (
    <div className="layout">
      <header className="app-header">
        <div className="branding" onClick={() => navigate("/")}>Bible Notes</div>
        <form className="header-search" onSubmit={handleHeaderSearchSubmit}>
          <input
            type="search"
            placeholder="Search commentaries or users"
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
      {location.pathname === "/" ? null : null}
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
                  onUpdateNote={async (noteId, payload) => {
                    try {
                      await api.updateNote(noteId, payload);
                      if (authToken) {
                        const my = await api.fetchMyNotes();
                        const filtered = my.notes.filter(n =>
                          n.start_book === selectedBook &&
                          n.start_chapter === selectedChapter
                        );
                        setNotes(filtered);
                      }
                    } catch (e) {
                      setNoteError(e.message || "Failed to update note");
                    }
                  }}
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
                  selectionMode={selectionMode}
                  onSelectionModeChange={setSelectionMode}
                  activeTab={rightPaneTab}
                />
                {rightPaneTab === "commentaries" ? (
                  <CommentaryPane
                    activeTab={rightPaneTab}
                    onChangeTab={setRightPaneTab}
                    isAuthenticated={Boolean(authToken)}
                    authors={authorSubscriptions}
                    selectedAuthorId={selectedAuthorId}
                    onSelectAuthor={handleSelectAuthor}
                    authorNotes={authorNotes}
                    isLoading={isLoadingCommentaries}
                  />
                ) : rightPaneTab === "manuscripts" ? (
                  <ManuscriptsPane
                    book={selectedBook}
                    chapter={selectedChapter}
                    activeTab={rightPaneTab}
                    onChangeTab={setRightPaneTab}
                  />
                ) : (
                  <AppConcordance
                    version={selectedVersion}
                    initialQuery={concordanceQuery || localStorage.getItem("lastWordSelectToken") || ""}
                    activeTab={rightPaneTab}
                    onChangeTab={setRightPaneTab}
                    onRefClick={(b, c, v) => {
                      setSelectedBook(b);
                      setSelectedChapter(c);
                      setPendingGoto({ book: b, chapter: c, verse: v });
                    }}
                  />
                )}
              </div>
            }
          />
          <Route
            path="/search"
            element={
              <SearchPage
                query={new URLSearchParams(location.search).get("q") || ""}
                onSubscribeAuthor={handleSubscribeAuthor}
                onUnsubscribeAuthor={handleUnsubscribeAuthor}
                subscriptions={authorSubscriptions}
                onOpenAuthor={id => navigate(`/users/${id}`)}
                isAuthenticated={Boolean(authToken)}
              />
            }
          />
          <Route
            path="/users/:id"
            element={
              <UserProfilePage
                onSelectAsCommentator={handleSelectAsCommentator}
                isAuthenticated={Boolean(authToken)}
                subscriptions={authorSubscriptions}
                onSubscribeAuthor={handleSubscribeAuthor}
                onUnsubscribeAuthor={handleUnsubscribeAuthor}
              />
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
                  <ProfilePage
                    profile={profileData}
                    isOwnProfile={true}
                    subscriptions={authorSubscriptions}
                    onUnsubscribeAuthor={handleUnsubscribeAuthor}
                    onUpdateNote={async (noteId, payload) => {
                      try {
                        await api.updateNote(noteId, payload);
                        const data = await api.fetchMyProfile();
                        setProfileData(data);
                      } catch (e) {
                        setProfileError(e.message || "Failed to update note");
                      }
                    }}
                  />
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
