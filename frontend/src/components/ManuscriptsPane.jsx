import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { api } from "../api";

function ManuscriptsPane({ book, chapter, activeTab, onChangeTab }) {
  const [available, setAvailable] = useState([]);
  const [selectedEdition, setSelectedEdition] = useState(() => localStorage.getItem("selectedManuscriptEdition") || "");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [verses, setVerses] = useState([]);
  const [editionMeta, setEditionMeta] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.fetchManuscriptsAvailable(book, chapter);
        if (cancelled) return;
        const editions = data?.editions || [];
        setAvailable(editions);
        // Ensure selection is valid for this book/chapter
        let next = selectedEdition;
        if (!next || !editions.some(e => e.code === next)) {
          next = editions.length ? editions[0].code : "";
        }
        setSelectedEdition(next);
      } catch {
        if (!cancelled) {
          setAvailable([]);
          setSelectedEdition("");
        }
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book, chapter]);

  useEffect(() => {
    if (selectedEdition) {
      localStorage.setItem("selectedManuscriptEdition", selectedEdition);
    } else {
      localStorage.removeItem("selectedManuscriptEdition");
    }
  }, [selectedEdition]);

  useEffect(() => {
    let cancelled = false;
    if (!selectedEdition) {
      setVerses([]);
      setEditionMeta(null);
      return;
    }
    setIsLoading(true);
    setError("");
    (async () => {
      try {
        const chapterData = await api.fetchManuscriptChapter(selectedEdition, book, chapter);
        if (cancelled) return;
        setVerses(chapterData?.verses || []);
        setEditionMeta(chapterData?.edition || null);
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load manuscript chapter");
          setVerses([]);
          setEditionMeta(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedEdition, book, chapter]);

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
        </div>
      </div>
      <div className="pane-content">
        <div className="commentary-section">
          <div className="section-title">Select Edition</div>
          {available.length ? (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                value={selectedEdition || ""}
                onChange={event => setSelectedEdition(event.target.value)}
              >
                {available.map(e => (
                  <option key={e.code} value={e.code}>
                    {e.name} ({e.code})
                  </option>
                ))}
              </select>
              {selectedEdition ? (
                <button type="button" aria-label="Clear selection" onClick={() => setSelectedEdition("")}>×</button>
              ) : null}
            </div>
          ) : (
            <div className="empty-state">No manuscript editions available for this book yet.</div>
          )}
        </div>

        {editionMeta ? (
          <div className="commentary-section">
            <div className="section-title">Edition</div>
            <div className="note-meta">
              {editionMeta.name} · {editionMeta.language} · {editionMeta.scope}
              {editionMeta.license_name ? ` · ${editionMeta.license_name}` : ""}
            </div>
          </div>
        ) : null}

        <div className="commentary-section">
          <div className="section-title">{book} {chapter}</div>
          {isLoading ? (
            <div className="loading-state">Loading…</div>
          ) : error ? (
            <div className="error-text">{error}</div>
          ) : verses.length ? (
            <div
              className="entries-list"
              style={{ direction: (editionMeta?.language === "heb" || editionMeta?.language === "arc" || editionMeta?.language === "syr") ? "rtl" : "ltr", textAlign: (editionMeta?.language === "heb" || editionMeta?.language === "arc" || editionMeta?.language === "syr") ? "right" : "left" }}
            >
              {verses.map(v => (
                <div key={v.id} className="entry-card">
                  <div className="note-meta">{v.chapter}:{v.verse}</div>
                  <div>{v.text}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">Select an edition to view this chapter.</div>
          )}
        </div>
      </div>
    </div>
  );
}

ManuscriptsPane.propTypes = {
  book: PropTypes.string.isRequired,
  chapter: PropTypes.number.isRequired,
  activeTab: PropTypes.string,
  onChangeTab: PropTypes.func
};

ManuscriptsPane.defaultProps = {
  activeTab: "manuscripts",
  onChangeTab: () => {}
};

export default ManuscriptsPane;
