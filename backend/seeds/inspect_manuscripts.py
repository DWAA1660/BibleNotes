import sqlite3
from pathlib import Path

db = Path("backend/bible_notes.db")
con = sqlite3.connect(db)
cur = con.cursor()
print("DB:", db.resolve())
print("coverage rows:", cur.execute("SELECT COUNT(*) FROM manuscriptbookcoverage").fetchone()[0])
print("verse rows:", cur.execute("SELECT COUNT(*) FROM manuscriptverse").fetchone()[0])
print("editions:", cur.execute("SELECT code, name, language, scope FROM manuscriptedition ORDER BY code").fetchall())
print("books sample:", cur.execute("SELECT book, COUNT(*) FROM manuscriptbookcoverage GROUP BY book ORDER BY book LIMIT 20").fetchall())
book = '1 Corinthians'
print(f"coverage for '{book}':", cur.execute("SELECT edition_code FROM manuscriptbookcoverage WHERE book=? ORDER BY edition_code", (book,)).fetchall())
print("distinct 1-* books:", cur.execute("SELECT DISTINCT book FROM manuscriptbookcoverage WHERE book LIKE '1 %' ORDER BY book").fetchall())
