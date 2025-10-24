import PropTypes from "prop-types";
import { useState } from "react";

function VersionSelector({
  versions,
  selectedVersion,
  onVersionChange,
  books,
  selectedBook,
  onBookChange,
  chapter,
  onChapterChange,
  verse,
  onVerseChange,
  loadingChapter = false,
  actions = null,
  onReferenceGo = null
}) {
  const [refText, setRefText] = useState("");
  return (
    <>
      <div className="toolbar">
        <div className="toolbar-section" style={{ gridColumn: "1 / -1" }}>
          <label htmlFor="ref-input">Reference</label>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              id="ref-input"
              type="text"
              placeholder="e.g., Romans 3:16"
              value={refText}
              onChange={e => setRefText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && onReferenceGo) {
                  onReferenceGo(refText);
                }
              }}
            />
            <button type="button" onClick={() => onReferenceGo && onReferenceGo(refText)}>Go</button>
          </div>
        </div>
      </div>
      <div className="toolbar">
        <div className="toolbar-section">
          <label htmlFor="version-select">Version</label>
          <select
            id="version-select"
            value={selectedVersion}
            onChange={event => onVersionChange(event.target.value)}
          >
            {versions.map(version => (
              <option key={version.code} value={version.code}>
                {version.name} ({version.language})
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-section">
          <label htmlFor="book-select">Book</label>
          <select
            id="book-select"
            value={selectedBook}
            onChange={event => onBookChange(event.target.value)}
          >
            {books.map(book => (
              <option key={book} value={book}>
                {book}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar-section">
          <label htmlFor="chapter-input">Chapter</label>
          <input
            id="chapter-input"
            type="number"
            min={1}
            value={chapter}
            onChange={event => onChapterChange(Number(event.target.value))}
          />
          {loadingChapter ? <span className="loading-state">Loading...</span> : null}
        </div>
        <div className="toolbar-section">
          <label htmlFor="verse-input">Verse</label>
          <input
            id="verse-input"
            type="number"
            min={1}
            value={verse ?? ""}
            onChange={event => {
              const value = event.target.value;
              const parsed = value === "" ? null : Number(value);
              onVerseChange(Number.isFinite(parsed) && parsed > 0 ? parsed : null);
            }}
          />
        </div>
        {actions ? <div className="toolbar-buttons">{actions}</div> : null}
      </div>
    </>
  );
}

VersionSelector.propTypes = {
  versions: PropTypes.arrayOf(
    PropTypes.shape({
      code: PropTypes.string.isRequired,
      name: PropTypes.string.isRequired,
      language: PropTypes.string.isRequired
    })
  ).isRequired,
  selectedVersion: PropTypes.string.isRequired,
  onVersionChange: PropTypes.func.isRequired,
  books: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectedBook: PropTypes.string.isRequired,
  onBookChange: PropTypes.func.isRequired,
  chapter: PropTypes.number.isRequired,
  onChapterChange: PropTypes.func.isRequired,
  verse: PropTypes.number,
  onVerseChange: PropTypes.func.isRequired,
  loadingChapter: PropTypes.bool,
  actions: PropTypes.node,
  onReferenceGo: PropTypes.func
};

export default VersionSelector;
