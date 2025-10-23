import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { api } from "../api";

function AppConcordance({ version, initialQuery, onRefClick, activeTab, onChangeTab }) {
  const [query, setQuery] = useState(initialQuery || "");
  const [expanded, setExpanded] = useState(() => localStorage.getItem("concordanceExpanded") === "1");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState({ query: "", version_code: version, total: 0, total_occurrences: 0, hits: [] });
  const [testament, setTestament] = useState("all"); // all | ot | nt
  const [book, setBook] = useState(""); // specific book or empty for all

  const OT = useMemo(() => new Set([
    "Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi"
  ]), []);
  const NT = useMemo(() => new Set([
    "Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"
  ]), []);

  useEffect(() => {
    localStorage.setItem("concordanceExpanded", expanded ? "1" : "0");
  }, [expanded]);

  const doSearch = async (q) => {
    const term = (q ?? query).trim();
    if (!term) {
      setResults({ query: "", version_code: version, total: 0, total_occurrences: 0, hits: [] });
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await api.fetchConcordance(version, term, { limit: 10000, offset: 0 });
      setResults(data);
      setBook("");
    } catch (e) {
      setResults({ query: term, version_code: version, total: 0, total_occurrences: 0, hits: [] });
      setError(e.message || "Search failed");
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-search when initialQuery changes or when version changes with a non-empty query
  useEffect(() => {
    const term = (initialQuery || "").trim();
    if (term && term !== results.query) {
      setQuery(term);
      doSearch(term);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery, version]);

  const booksInResults = useMemo(() => {
    const set = new Set();
    for (const h of results.hits || []) {
      if (testament === "ot" && !OT.has(h.book)) continue;
      if (testament === "nt" && !NT.has(h.book)) continue;
      set.add(h.book);
    }
    return Array.from(set);
  }, [results.hits, testament, OT, NT]);

  useEffect(() => {
    if (book && !booksInResults.includes(book)) {
      setBook("");
    }
  }, [booksInResults, book]);

  const filtered = useMemo(() => {
    const hits = results.hits || [];
    const filteredHits = hits.filter(h => {
      if (testament === "ot" && !OT.has(h.book)) return false;
      if (testament === "nt" && !NT.has(h.book)) return false;
      if (book && h.book !== book) return false;
      return true;
    });
    const totalOccurrences = filteredHits.reduce((acc, h) => acc + (h.occurrences || 0), 0);
    return {
      hits: filteredHits,
      total: filteredHits.length,
      total_occurrences: totalOccurrences
    };
  }, [results.hits, testament, book, OT, NT]);

  return (
    <div className="pane">
      <div className="pane-header tabs-header">
        <div className="tabbar">
          <button
            type="button"
            className={`tab ${activeTab === "commentaries" ? "active" : ""}`}
            onClick={() => onChangeTab("commentaries")}
          >
            Commentaries
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "manuscripts" ? "active" : ""}`}
            onClick={() => onChangeTab("manuscripts")}
          >
            Manuscripts
          </button>
          <button
            type="button"
            className={`tab ${activeTab === "concordance" ? "active" : ""}`}
            onClick={() => onChangeTab("concordance")}
          >
            Concordance
          </button>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <label style={{ display: "inline-flex", gap: "0.35rem", alignItems: "center" }}>
            <input type="checkbox" checked={expanded} onChange={e => setExpanded(e.target.checked)} />
            Expanded view
          </label>
        </div>
      </div>
      <div className="pane-content">
        <div className="commentary-section">
          <div className="section-title">Search</div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              className="search-input"
              placeholder="Enter word to search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") doSearch(); }}
            />
            <button type="button" onClick={() => doSearch()}>Search</button>
          </div>
          {results?.query ? (
            <div className="note-meta" style={{ marginTop: "0.25rem", display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              <span>{filtered.total} verses, {filtered.total_occurrences} total occurrences for “{results.query}” in {results.version_code}</span>
              <span>|</span>
              <select value={testament} onChange={e => setTestament(e.target.value)}>
                <option value="all">All Testaments</option>
                <option value="ot">Old Testament</option>
                <option value="nt">New Testament</option>
              </select>
              <select value={book} onChange={e => setBook(e.target.value)}>
                <option value="">All Books</option>
                {booksInResults.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          ) : null}
          {error ? <div className="error-text">{error}</div> : null}
        </div>

        {isLoading ? (
          <div className="loading-state">Searching…</div>
        ) : filtered.hits?.length ? (
          <div className="entries-list">
            {filtered.hits.map(hit => (
              <div key={`${hit.book}|${hit.chapter}|${hit.verse}`} className="entry-card">
                <div className="note-meta" style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>{hit.book} {hit.chapter}:{hit.verse}</span>
                  <span>{hit.occurrences} occurrence{hit.occurrences !== 1 ? "s" : ""}</span>
                </div>
                {expanded ? (
                  <div>{hit.text}</div>
                ) : null}
                <div style={{ marginTop: "0.5rem" }}>
                  <button type="button" onClick={() => onRefClick?.(hit.book, hit.chapter, hit.verse)}>Go to verse</button>
                </div>
              </div>
            ))}
          </div>
        ) : results.query ? (
          <div className="empty-state">No matches found.</div>
        ) : null}
      </div>
    </div>
  );
}

AppConcordance.propTypes = {
  version: PropTypes.string.isRequired,
  initialQuery: PropTypes.string,
  onRefClick: PropTypes.func,
  activeTab: PropTypes.string,
  onChangeTab: PropTypes.func
};

export default AppConcordance;
