import { useEffect, useMemo, useState } from "react";
import { api, setToken } from "./api.js";
import VersionSelector from "./components/VersionSelector.jsx";
import BiblePane from "./components/BiblePane.jsx";
import NotesPane from "./components/NotesPane.jsx";
import CommentaryPane from "./components/CommentaryPane.jsx";
import AccountPanel from "./components/AccountPanel.jsx";

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
  const [searchTerm, setSearchTerm] = useState("");
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [accountTab, setAccountTab] = useState("me");
  const [myNotes, setMyNotes] = useState([]);
  const [isLoadingMyNotes, setIsLoadingMyNotes] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [authorResults, setAuthorResults] = useState([]);
  const [selectedAuthor, setSelectedAuthor] = useState(null);
  const [isLoadingAuthors, setIsLoadingAuthors] = useState(false);
  const [isLoadingAuthorNotes, setIsLoadingAuthorNotes] = useState(false);

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
    async function loadPublic() {
      setIsLoadingCommentaries(true);
      try {
        const data = await api.fetchPublicCommentaries(searchTerm);
        setPublicCommentaries(data);
      } catch {
        setPublicCommentaries([]);
      } finally {
        setIsLoadingCommentaries(false);
      }
    }
    loadPublic();
  }, [searchTerm]);

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
      setIsAccountOpen(false);
    } catch (error) {
      setAuthError(error.message || "Authentication failed");
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setToken(null);
    localStorage.removeItem("authToken");
    setSubscriptions([]);
    setIsAccountOpen(false);
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
    setNoteError("");
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

  const handleSearchChange = value => {
    setSearchTerm(value);
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

  const handleToggleAccount = () => {
    setIsAccountOpen(prev => !prev);
  };

  const handleAccountTabChange = tab => {
    setAccountTab(tab);
    setAccountError("");
    if (tab === "me") {
      setSelectedAuthor(null);
    }
  };

  const handleUpdateNote = async (noteId, payload) => {
    try {
      const updated = await api.updateNote(noteId, payload);
      setMyNotes(prev => prev.map(note => (note.id === noteId ? updated : note)));
      if (selectedAuthor && selectedAuthor.author_id === updated.owner_id) {
        setSelectedAuthor(prev =>
          prev
            ? {
                ...prev,
                notes: prev.notes.map(note => (note.id === noteId ? updated : note))
              }
            : prev
        );
      }
      setAccountError("");
      return updated;
    } catch (error) {
      setAccountError(error.message || "Failed to update note");
      throw error;
    }
  };

  const handleFetchAuthor = async authorId => {
    setIsLoadingAuthorNotes(true);
    setAccountError("");
    try {
      const data = await api.fetchAuthorNotes(authorId);
      setSelectedAuthor(data);
    } catch (error) {
      setAccountError(error.message || "Failed to load author notes");
      setSelectedAuthor(null);
    } finally {
      setIsLoadingAuthorNotes(false);
    }
  };

  useEffect(() => {
    if (!isAccountOpen) {
      setAuthError("");
      setAccountError("");
    }
  }, [isAccountOpen]);

  useEffect(() => {
    if (!isAccountOpen || !authToken || accountTab !== "me") {
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingMyNotes(true);
      setAccountError("");
      try {
        const data = await api.fetchMyNotes();
        if (!cancelled) {
          setMyNotes(data.notes);
        }
      } catch (error) {
        if (!cancelled) {
          setAccountError(error.message || "Failed to load notes");
          setMyNotes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMyNotes(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAccountOpen, accountTab, authToken]);

  useEffect(() => {
    if (!isAccountOpen || accountTab !== "search") {
      return;
    }
    let cancelled = false;
    (async () => {
      setIsLoadingAuthors(true);
      setAccountError("");
      try {
        const data = await api.searchAuthors(userSearch);
        if (!cancelled) {
          setAuthorResults(data.authors);
        }
      } catch (error) {
        if (!cancelled) {
          setAccountError(error.message || "Failed to search users");
          setAuthorResults([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingAuthors(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAccountOpen, accountTab, userSearch]);

  return (
    <div className="layout">
      <header className="app-header">
        <div className="branding">Bible Notes</div>
      </header>
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
        actions={
          <button type="button" onClick={handleToggleAccount}>
            Account
          </button>
        }
      />
      {isAccountOpen ? (
        <div className="account-panel">
          {authToken ? (
            <AccountPanel
              onLogout={handleLogout}
              error={accountError}
              tab={accountTab}
              onTabChange={handleAccountTabChange}
              myNotes={myNotes}
              isLoadingMyNotes={isLoadingMyNotes}
              onUpdateNote={handleUpdateNote}
              searchTerm={userSearch}
              onSearchChange={setUserSearch}
              authorResults={authorResults}
              onSelectAuthor={handleFetchAuthor}
              selectedAuthor={selectedAuthor}
              isLoadingAuthors={isLoadingAuthors}
              isLoadingAuthorNotes={isLoadingAuthorNotes}
            />
          ) : (
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
          )}
          {authToken ? null : authError ? <div className="error-text">{authError}</div> : null}
        </div>
      ) : null}
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
          onSearch={handleSearchChange}
          searchTerm={searchTerm}
          isAuthenticated={Boolean(authToken)}
          isLoading={isLoadingCommentaries}
        />
      </div>
    </div>
  );
}

export default App;
