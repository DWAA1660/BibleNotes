import { useEffect, useMemo, useState } from "react";
import { api, setToken } from "./api.js";
import VersionSelector from "./components/VersionSelector.jsx";
import BiblePane from "./components/BiblePane.jsx";
import NotesPane from "./components/NotesPane.jsx";
import CommentaryPane from "./components/CommentaryPane.jsx";

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
  const [selectedVersion, setSelectedVersion] = useState("");
  const [selectedBook, setSelectedBook] = useState("Genesis");
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [chapterData, setChapterData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedVerseId, setSelectedVerseId] = useState(null);
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

  useEffect(() => {
    setToken(authToken);
  }, [authToken]);

  useEffect(() => {
    async function loadVersions() {
      try {
        const data = await api.fetchVersions();
        setVersions(data);
        if (data.length > 0) {
          setSelectedVersion(prev => prev || data[0].code);
        }
      } catch {
        setVersions([]);
      }
    }
    loadVersions();
  }, []);

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
          setSelectedVerseId(prev => prev || data.verses[0].id);
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
        const data = await api.fetchSubscriptions();
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
    const form = new FormData(event.currentTarget);
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
      event.currentTarget.reset();
    } catch (error) {
      setAuthError(error.message || "Authentication failed");
    }
  };

  const handleLogout = () => {
    setAuthToken(null);
    setToken(null);
    localStorage.removeItem("authToken");
    setSubscriptions([]);
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

  return (
    <div className="layout">
      <header className="app-header">
        <div className="branding">Bible Notes</div>
        <div className="auth">
          {authToken ? (
            <div className="auth-row">
              <button type="button" onClick={handleLogout}>Logout</button>
            </div>
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
          {authError ? <div className="error-text">{authError}</div> : null}
        </div>
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
      />
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
