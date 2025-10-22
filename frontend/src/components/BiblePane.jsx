import PropTypes from "prop-types";

function BiblePane({ chapterData, selectedVerseId, onSelectVerse, isLoading }) {
  return (
    <div className="pane">
      <div className="pane-header">Bible Text</div>
      <div className="pane-content">
        {isLoading ? (
          <div className="loading-state">Loading chapter...</div>
        ) : !chapterData ? (
          <div className="empty-state">Select a version, book, and chapter to begin.</div>
        ) : (
          <div className="verse-list">
            {chapterData.verses.map(verse => (
              <div
                key={verse.id}
                className={`verse-item${verse.id === selectedVerseId ? " active" : ""}`}
                onClick={() => onSelectVerse(verse.id)}
              >
                <div>
                  <span className="verse-number">{verse.verse}</span>
                  <span dangerouslySetInnerHTML={{ __html: verse.text }} />
                </div>
                {verse.backlinks.length ? (
                  <div className="backlinks">
                    Backlinks: {verse.backlinks.length}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

BiblePane.propTypes = {
  chapterData: PropTypes.shape({
    verses: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.number.isRequired,
        verse: PropTypes.number.isRequired,
        text: PropTypes.string.isRequired,
        backlinks: PropTypes.array.isRequired
      })
    )
  }),
  selectedVerseId: PropTypes.number,
  onSelectVerse: PropTypes.func.isRequired,
  isLoading: PropTypes.bool
};

BiblePane.defaultProps = {
  chapterData: null,
  selectedVerseId: null,
  isLoading: false
};

export default BiblePane;
