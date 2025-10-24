// App shell
// - Manages global state: selected version/book/chapter/verse, auth token, panes, and subscriptions.
// - Routes:
//   /            => main 3-pane view (NotesPane · BiblePane · Right pane: Commentaries/Manuscripts/Concordance)
//   /search      => search page for users/commentaries
//   /users/:id   => public user page (author profile)
//   /profile     => private profile page (logged-in user's own notes)
// - NotesPane receives only the user's notes for the current chapter (filtered here after /notes/me).
// - Handles note create/update by calling backend APIs, then refreshes notes/profile data.
import { useCallback, useEffect, useMemo, useState } from "react";
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
  const location = useLocation();
  const navigate = useNavigate();
  const referenceFromUrl = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const versionParam = params.get("version") || "";
    const bookParam = params.get("book") || "";
    const chapterParam = params.get("chapter");
    const verseParam = params.get("verse");
    const chapterValue = chapterParam ? Number.parseInt(chapterParam, 10) : NaN;
    const verseValue = verseParam ? Number.parseInt(verseParam, 10) : NaN;
    const normalizedChapter = Number.isInteger(chapterValue) && chapterValue > 0 ? chapterValue : null;
    const normalizedVerse = Number.isInteger(verseValue) && verseValue > 0 ? verseValue : null;
    return {
      version: versionParam || null,
      book: BOOKS.includes(bookParam) ? bookParam : null,
      chapter: normalizedChapter,
      verse: normalizedVerse
    };
  }, [location.search]);

  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(() => referenceFromUrl.version || "");
  const [selectedBook, setSelectedBook] = useState(() => referenceFromUrl.book || "Genesis");
  const [selectedChapter, setSelectedChapter] = useState(() => referenceFromUrl.chapter || 1);
  const [requestedVerseNumber, setRequestedVerseNumber] = useState(() => referenceFromUrl.verse ?? null);
  const [chapterData, setChapterData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [selectedVerseId, setSelectedVerseId] = useState(null);
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("authToken"));
  const [authMode, setAuthMode] = useState("login");
  const [authError, setAuthError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);
  const [isLoadingNotes, setIsLoadingNotes] =useState(false);
  const [isLoadingCommentaries, setIsLoadingCommentaries] = useState(false);
  const [authorSubscriptions, setAuthorSubscriptions] = useState([]);
  const [selectedAuthorId, setSelectedAuthorId] = useState(() => {
    const stored = localStorage.getItem("selectedAuthorId");
    return stored ? Number(stored) || null : null;
  });
  const [authorNotes, setAuthorNotes] = useState([]);
  const [commentarySearchTerm, setCommentarySearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [profileData, setProfileData] = useState(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [rightPaneTab, setRightPaneTab] = useState(() => localStorage.getItem("rightPaneTab") || "commentaries");
  const [selectionMode, setSelectionMode] = useState(() => localStorage.getItem("selectionMode") || "verse");
  const [pendingGoto, setPendingGoto] = useState(null);
  const [concordanceQuery, setConcordanceQuery] = useState("");
  const [backlinks, setBacklinks] = useState([]);
  const [isLoadingBacklinks, setIsLoadingBacklinks] = useState(false);
  const [syncNotes, setSyncNotes] = useState(() => localStorage.getItem("syncNotes") === "1");
  // Create Note modal state (opened from BiblePane per-verse Add button)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [modalBook, setModalBook] = useState("");
  const [modalChapter, setModalChapter] = useState(0);
  const [modalVerseNumber, setModalVerseNumber] = useState(0);
  const [modalVerseId, setModalVerseId] = useState(null);
  const [modalEndVerseId, setModalEndVerseId] = useState(null);
  const [modalEndOptions, setModalEndOptions] = useState([]);
  const [modalTitle, setModalTitle] = useState("");
  const [modalContent, setModalContent] = useState("");
  const [modalIsPublic, setModalIsPublic] = useState(false);
  const [modalTags, setModalTags] = useState("");

  const modalVersePreview = useMemo(() => {
    if (!isCreateModalOpen || !chapterData || !modalVerseId) return [];
    const verses = chapterData.verses || [];
    const start = verses.find(v => v.id === modalVerseId);
    if (!start) return [];
    const endId = modalEndVerseId || modalVerseId;
    const end = verses.find(v => v.id === endId) || start;
    const a = Number(start.verse) || 0;
    const b = Number(end.verse) || a;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    return verses
      .filter(v => v.verse >= lo && v.verse <= hi)
      .map(v => ({ num: v.verse, text: v.text }));
  }, [isCreateModalOpen, chapterData, modalVerseId, modalEndVerseId]);

  // Utility: map a free-text book name to a canonical entry in BOOKS
  const resolveBook = useCallback((raw) => {
    if (!raw) return null;
    const norm = String(raw).toLowerCase().replace(/[^a-z0-9]/g, "");
    // Prefer exact normalized match, then startsWith
    let found = BOOKS.find(b => b.toLowerCase().replace(/[^a-z0-9]/g, "") === norm);
    if (found) return found;
    found = BOOKS.find(b => b.toLowerCase().replace(/[^a-z0-9]/g, "").startsWith(norm));
    return found || null;
  }, []);

  const handleReferenceGo = useCallback((text) => {
    const s = (text || "").trim();
    if (!s) return;
    // Accept formats like "Romans 3:16", "1 Cor 5:7", or with a space separator: "Romans 3 16"
    const m = s.match(/^\s*(.+?)\s+(\d+)[\s:](\d+)\s*$/i);
    if (!m) return;
    const bookLabel = resolveBook(m[1]);
    const chapter = Number(m[2]);
    const verse = Number(m[3]);
    if (!bookLabel || !Number.isFinite(chapter) || chapter <= 0 || !Number.isFinite(verse) || verse <= 0) return;

    setSelectedBook(bookLabel);
    setSelectedChapter(chapter);
    setRequestedVerseNumber(verse);
    setPendingGoto({ book: bookLabel, chapter, verse });

    if (location.pathname !== "/") {
      const params = new URLSearchParams();
      if (selectedVersion) params.set("version", selectedVersion);
      params.set("book", bookLabel);
      params.set("chapter", String(chapter));
      params.set("verse", String(verse));
      navigate({ pathname: "/", search: `?${params.toString()}` });
    }
  }, [location.pathname, navigate, resolveBook, selectedVersion]);

  useEffect(() => {
    if (location.pathname !== "/") {
      return;
    }
    const { version, book, chapter, verse } = referenceFromUrl;
    setSelectedVersion(prev => {
      if (version && prev !== version) {
        return version;
      }
      if (!prev && version) {
        return version;
      }
      return prev;
    });
    setSelectedBook(prev => {
      if (book && prev !== book) {
        return book;
      }
      return prev;
    });
    setSelectedChapter(prev => {
      if (chapter && prev !== chapter) {
        return chapter;
      }
      return prev;
    });
    setRequestedVerseNumber(prev => {
      if (verse !== null && prev !== verse) {
        return verse;
      }
      if (verse === null && prev !== null) {
        return null;
      }
      return prev;
    });
  }, [referenceFromUrl, location.pathname]);

  useEffect(() => {
    if (location.pathname !== "/") {
      return;
    }
    const params = new URLSearchParams();
    if (selectedVersion) params.set("version", selectedVersion);
    if (selectedBook) params.set("book", selectedBook);
    if (selectedChapter) params.set("chapter", String(selectedChapter));
    if (requestedVerseNumber) params.set("verse", String(requestedVerseNumber));
    const nextSearch = params.toString();
    const currentSearch = location.search.startsWith("?") ? location.search.slice(1) : location.search;
    if (nextSearch !== currentSearch) {
      navigate({ pathname: location.pathname, search: nextSearch ? `?${nextSearch}` : "" }, { replace: true });
    }
  }, [selectedVersion, selectedBook, selectedChapter, requestedVerseNumber, location.pathname, location.search, navigate]);

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
    try { localStorage.setItem("syncNotes", syncNotes ? "1" : "0"); } catch {}
  }, [syncNotes]);

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
      const detail = { book: pendingGoto.book, chapter: pendingGoto.chapter, verse: pendingGoto.verse };
      // Dispatch now and also on next frames to ensure listeners and DOM are ready
      try { window.dispatchEvent(new CustomEvent("goto-verse", { detail })); } catch {}
      requestAnimationFrame(() => {
        try { window.dispatchEvent(new CustomEvent("goto-verse", { detail })); } catch {}
      });
      setTimeout(() => {
        try { window.dispatchEvent(new CustomEvent("goto-verse", { detail })); } catch {}
      }, 50);
    }
    setPendingGoto(null);
  }, [pendingGoto, chapterData]);

  const openCreateNoteModal = useCallback((book, chapter, verseNumber, verseId) => {
    if (!authToken) {
      setIsAuthOpen(true);
      return;
    }
    setModalBook(book);
    setModalChapter(chapter);
    setModalVerseNumber(verseNumber);
    setModalVerseId(verseId);
    // Build end-verse options from current chapter data
    const options = (chapterData?.verses || [])
      .filter(v => v.verse >= verseNumber)
      .map(v => ({ id: v.id, label: `${v.chapter}:${v.verse}` }));
    setModalEndOptions(options);
    setModalEndVerseId(verseId);
    setModalTitle("");
    setModalContent("");
    setModalIsPublic(false);
    setModalTags("");
    setIsCreateModalOpen(true);
  }, [authToken, chapterData]);

  const closeCreateNoteModal = useCallback(() => {
    setIsCreateModalOpen(false);
  }, []);

  const submitCreateNoteModal = useCallback(async () => {
    if (!authToken || !selectedVersion || !modalVerseId) return;
    try {
      await api.createNote({
        title: modalTitle,
        content_markdown: modalContent,
        version_code: selectedVersion,
        start_verse_id: modalVerseId,
        end_verse_id: modalEndVerseId || modalVerseId,
        is_public: modalIsPublic,
        tags: modalTags
      });
      // Refresh my notes for current chapter
      if (authToken) {
        const my = await api.fetchMyNotes();
        const filtered = my.notes.filter(n =>
          n.version_code === selectedVersion &&
          n.start_book === selectedBook &&
          n.start_chapter === selectedChapter
        );
        setNotes(filtered);
      }
      // Navigate/scroll to the verse
      setSelectedBook(modalBook);
      setSelectedChapter(modalChapter);
      setRequestedVerseNumber(modalVerseNumber);
      setPendingGoto({ book: modalBook, chapter: modalChapter, verse: modalVerseNumber });
      setIsCreateModalOpen(false);
    } catch (e) {
      setNoteError(e.message || "Failed to create note");
    }
  }, [authToken, selectedVersion, selectedBook, selectedChapter, modalVerseId, modalEndVerseId, modalTitle, modalContent, modalIsPublic, modalTags, modalBook, modalChapter, modalVerseNumber]);

  // Global navigation request from panes (e.g., backlinks click)
  useEffect(() => {
    function onOpenVerse(e) {
      const d = e.detail || {};
      if (!d.book || !d.chapter || !d.verse) return;

      const chapter = Number(d.chapter);
      const verse = Number(d.verse);
      const version = d.version || selectedVersion || "";

      if (version && version !== selectedVersion) {
        setSelectedVersion(version);
      }

      setSelectedBook(d.book);
      setSelectedChapter(chapter);
      setRequestedVerseNumber(verse);
      setPendingGoto({ book: d.book, chapter, verse });

      if (location.pathname !== "/") {
        const params = new URLSearchParams();
        if (version) params.set("version", version);
        params.set("book", d.book);
        params.set("chapter", String(chapter));
        params.set("verse", String(verse));
        const search = params.toString();
        navigate({ pathname: "/", search: search ? `?${search}` : "" });
      }
    }
    window.addEventListener("open-verse", onOpenVerse);
    return () => window.removeEventListener("open-verse", onOpenVerse);
  }, [location.pathname, navigate, selectedVersion]);

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
          const order = new Map(BOOKS.map((b, i) => [b, i]));
          filtered.sort((a, b) => {
            const ai = order.get(a.start_book) ?? 999;
            const bi = order.get(b.start_book) ?? 999;
            if (ai !== bi) return ai - bi;
            if (a.start_chapter !== b.start_chapter) return a.start_chapter - b.start_chapter;
            return a.start_verse - b.start_verse;
          });
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
    if (!chapterData || requestedVerseNumber != null) {
      return;
    }
    const verse = chapterData.verses.find(v => v.id === selectedVerseId);
    if (verse && verse.verse !== requestedVerseNumber) {
      setRequestedVerseNumber(verse.verse);
    }
  }, [chapterData, selectedVerseId, requestedVerseNumber]);

  useEffect(() => {
    if (!chapterData || requestedVerseNumber == null) {
      return;
    }
    const match = chapterData.verses.find(v => v.verse === requestedVerseNumber);
    if (match && match.id !== selectedVerseId) {
      setSelectedVerseId(match.id);
    }
  }, [chapterData, requestedVerseNumber, selectedVerseId]);

  // When verse number changes (e.g., via Verse input), scroll to the verse unless a pendingGoto flow will handle it
  useEffect(() => {
    if (!chapterData || requestedVerseNumber == null || pendingGoto) return;
    try {
      window.dispatchEvent(new CustomEvent("goto-verse", { detail: { book: selectedBook, chapter: selectedChapter, verse: requestedVerseNumber } }));
    } catch {}
  }, [chapterData?.book, chapterData?.chapter, requestedVerseNumber, pendingGoto, selectedBook, selectedChapter]);

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
        const arr = Array.isArray(data?.notes) ? data.notes : [];
        const order = new Map(BOOKS.map((b, i) => [b, i]));
        arr.sort((a, b) => {
          const ai = order.get(a.start_book) ?? 999;
          const bi = order.get(b.start_book) ?? 999;
          if (ai !== bi) return ai - bi;
          const ac = Number(a.start_chapter) || 0;
          const bc = Number(b.start_chapter) || 0;
          if (ac !== bc) return ac - bc;
          const av = Number(a.start_verse) || 0;
          const bv = Number(b.start_verse) || 0;
          return av - bv;
        });
        setAuthorNotes(arr);
      } catch {
        setAuthorNotes([]);
      } finally {
        setIsLoadingCommentaries(false);
      }
    })();
  }, [selectedAuthorId]);

  const handleSubscribeAuthor = async authorId => {
    if (!authToken) { setIsAuthOpen(true); return; }
    try {
      const sub = await api.subscribeAuthor(authorId);
      setAuthorSubscriptions(prev => {
        const exists = prev.find(s => s.author_id === sub.author_id);
        return exists ? prev : [...prev, sub];
      });
    } catch {}
  };

  const handleVersionChange = useCallback(value => {
    setSelectedVersion(value);
    setSelectedVerseId(null);
    setRequestedVerseNumber(null);
  }, [setSelectedVersion, setSelectedVerseId, setRequestedVerseNumber]);

  const handleBookChange = useCallback(value => {
    setSelectedBook(value);
    setSelectedChapter(1);
    setSelectedVerseId(null);
    setRequestedVerseNumber(null);
  }, [setSelectedBook, setSelectedChapter, setSelectedVerseId, setRequestedVerseNumber]);

  const handleChapterChange = useCallback(value => {
    setSelectedChapter(value);
    setSelectedVerseId(null);
    setRequestedVerseNumber(null);
  }, [setSelectedChapter, setSelectedVerseId, setRequestedVerseNumber]);

  const handleVerseChange = useCallback(value => {
    setRequestedVerseNumber(value);
    if (value == null) {
      setSelectedVerseId(null);
    }
  }, [setRequestedVerseNumber, setSelectedVerseId]);

  const handleSelectAsCommentator = async authorId => {
    await handleSubscribeAuthor(authorId);
    await handleSelectAuthor(authorId);
    navigate("/");
  };

  const handleUnsubscribeAuthor = async authorId => {
    if (!authToken) { setIsAuthOpen(true); return; }
    try {
      await api.unsubscribeAuthor(authorId);
      setAuthorSubscriptions(prev => prev.filter(s => s.author_id !== authorId));
    } catch {}
  };

  const handleSelectAuthor = async (authorId) => {
    const id = authorId || null;
    setSelectedAuthorId(id);
    if (!id) {
      setAuthorNotes([]);
      return;
    }
    setIsLoadingCommentaries(true);
    try {
      const data = await api.fetchAuthorNotes(id);
      const arr = Array.isArray(data?.notes) ? data.notes : [];
      const order = new Map(BOOKS.map((b, i) => [b, i]));
      arr.sort((a, b) => {
        const ai = order.get(a.start_book) ?? 999;
        const bi = order.get(b.start_book) ?? 999;
        if (ai !== bi) return ai - bi;
        const ac = Number(a.start_chapter) || 0;
        const bc = Number(b.start_chapter) || 0;
        if (ac !== bc) return ac - bc;
        const av = Number(a.start_verse) || 0;
        const bv = Number(b.start_verse) || 0;
        return av - bv;
      });
      setAuthorNotes(arr);
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

  // Use chapter-provided backlinks on the selected verse
  useEffect(() => {
    if (!selectedVerse) {
      setBacklinks([]);
      return;
    }
    setBacklinks(Array.isArray(selectedVerse.backlinks) ? selectedVerse.backlinks : []);
    setIsLoadingBacklinks(false);
  }, [selectedVerse?.id]);

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
        is_public: payload.isPublic,
        tags: payload.tags
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
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="pane-header" style={{ borderBottom: "none", padding: 0, marginBottom: "0.5rem" }}>
              <div style={{ fontWeight: 600 }}>{authMode === "signup" ? "Create account" : "Login"}</div>
            </div>
            <form className="auth-form" onSubmit={handleAuthSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              <input name="email" type="email" placeholder="Email" required />
              <input name="password" type="password" placeholder="Password" required />
              {authMode === "signup" ? (
                <input name="displayName" type="text" placeholder="Display name (optional)" />
              ) : null}
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={() => setIsAuthOpen(false)}>Cancel</button>
                <button type="submit">{authMode === "signup" ? "Create account" : "Login"}</button>
              </div>
            </form>
            <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div className="error-text">{!authToken && authError ? authError : ""}</div>
              {authMode === "signup" ? (
                <button type="button" className="note-link" onClick={() => setAuthMode("login")}>Back to login</button>
              ) : (
                <button type="button" className="note-link" onClick={() => setAuthMode("signup")}>Create account</button>
              )}
            </div>
          </div>
        </div>
      ) : null}
      {location.pathname === "/" ? (
        <VersionSelector
          versions={versions}
          selectedVersion={selectedVersion}
          onVersionChange={handleVersionChange}
          books={BOOKS}
          selectedBook={selectedBook}
          onBookChange={handleBookChange}
          chapter={selectedChapter}
          onChapterChange={handleChapterChange}
          verse={requestedVerseNumber}
          onVerseChange={handleVerseChange}
          loadingChapter={isLoadingChapter}
          onReferenceGo={handleReferenceGo}
        />
      ) : (
        <div className="toolbar-placeholder">
          <h2>Profile</h2>
        </div>
      )}
      {location.pathname === "/" ? null : null}
      {isCreateModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <div className="pane-header" style={{ borderBottom: "none", padding: 0, marginBottom: "0.5rem" }}>
              <div style={{ fontWeight: 600 }}>Add Note · {modalBook} {modalChapter}:{modalVerseNumber}</div>
            </div>
            {modalVersePreview.length ? (
              <div className="verse-box" style={{ border: "1px solid var(--border)", borderRadius: "0.5rem", padding: "0.5rem", marginBottom: "0.75rem", background: "#f9fafb" }}>
                {modalVersePreview.map(v => (
                  <div key={v.num} className="note-meta">
                    <strong style={{ marginRight: "0.35rem" }}>{v.num}</strong>
                    <span dangerouslySetInnerHTML={{ __html: v.text }} />
                  </div>
                ))}
              </div>
            ) : null}
            <form className="notes-form" onSubmit={e => { e.preventDefault(); submitCreateNoteModal(); }}>
              <input type="text" placeholder="Title" value={modalTitle} onChange={e => setModalTitle(e.target.value)} />
              <textarea placeholder="Write your note..." value={modalContent} onChange={e => setModalContent(e.target.value)} />
              <div className="notes-form-row" style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <label>End verse</label>
                <select value={modalEndVerseId || modalVerseId} onChange={e => setModalEndVerseId(Number(e.target.value))}>
                  {modalEndOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
                <label style={{ marginLeft: "auto" }}>
                  <input type="checkbox" checked={modalIsPublic} onChange={e => setModalIsPublic(e.target.checked)} /> Public
                </label>
              </div>
              <input type="text" placeholder="Tags (comma-separated)" value={modalTags} onChange={e => setModalTags(e.target.value)} />
              <div className="modal-actions" style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                <button type="button" onClick={closeCreateNoteModal}>Cancel</button>
                <button type="submit">Create</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
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
                        const order = new Map(BOOKS.map((b, i) => [b, i]));
                        filtered.sort((a, b) => {
                          const ai = order.get(a.start_book) ?? 999;
                          const bi = order.get(b.start_book) ?? 999;
                          if (ai !== bi) return ai - bi;
                          if (a.start_chapter !== b.start_chapter) return a.start_chapter - b.start_chapter;
                          return a.start_verse - b.start_verse;
                        });
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
                  currentUser={profileData || null}
                  backlinks={backlinks}
                  isLoadingBacklinks={isLoadingBacklinks}
                  syncNotes={syncNotes}
                  onToggleSync={() => setSyncNotes(v => !v)}
                  book={selectedBook}
                  chapter={selectedChapter}
                />
                <BiblePane
                  chapterData={chapterData}
                  selectedVerseId={selectedVerseId}
                  onSelectVerse={(verseId, verseNumber) => {
                    setSelectedVerseId(verseId);
                    setRequestedVerseNumber(verseNumber ?? null);
                  }}
                  isLoading={isLoadingChapter}
                  selectionMode={selectionMode}
                  onSelectionModeChange={setSelectionMode}
                  activeTab={rightPaneTab}
                  onAddNote={(b, c, v, id) => openCreateNoteModal(b, c, v, id)}
                  syncNotes={syncNotes}
                />
                {rightPaneTab === "commentaries" ? (
                  <CommentaryPane
                    activeTab={rightPaneTab}
                    onChangeTab={setRightPaneTab}
                    isAuthenticated={Boolean(authToken)}
                    authors={authorSubscriptions}
                    selectedAuthorId={selectedAuthorId}
                    onSelectAuthor={handleSelectAuthor}
                    authorNotes={authorNotes.filter(n => n.start_book === selectedBook && n.start_chapter === selectedChapter)}
                    isLoading={isLoadingCommentaries}
                    selectedVerse={selectedVerse}
                    book={selectedBook}
                    chapter={selectedChapter}
                    verses={chapterData ? chapterData.verses : []}
                    syncNotes={syncNotes}
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
                      setRequestedVerseNumber(v);
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
