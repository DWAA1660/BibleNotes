Build a web app in Python: a Bible reader + notes + community commentaries. Focus on: versions, verse-level notes, user accounts, backlinks between scripture references, and public/private personal commentaries. Deliver a complete, working project blueprint and example code for backend + minimal frontend. Requirements:

Tech stack:
- Python backend
- Database: Sqlite.
- Authentication: simple email + password sign-up/login (no email verification). Store hashed passwords (bcrypt/argon2).
- Frontend: minimal React app (or plain server-rendered templates) with three main panels: center = Bible reader (switchable versions), right = commentary selector (choose from multiple commentaries per verse), left = advanced notes (per-verse or per-range).
- APIs: RESTful endpoints for auth, versions, verses, notes, commentaries, backlinks, search.
- Text rendering: notes and commentaries accept Markdown; render as sanitized HTML.
- Search: full-text search using PostgreSQL tsvector (or provide Elasticsearch option).
- Access control: notes/commentaries can be PRIVATE (only owner) or PUBLIC (readable by others). Users can "follow" or "add" public commentaries to their commentary list.

Core features to implement:
1. Bible Versions
   - Support multiple versions All versions json is in ./bibles
   - UI: version selector that updates the center pane in real time without reloading the whole page.

2. Verse-level Notes & Backlinks
   - Notes are attached to a canonical verse ID or a verse range. Each note belongs to a user account.
   - If a user types a reference to another scripture inside a note (e.g., "See John 3:16"), the system creates a backlink from the referenced verse to the current note location and stores it in the DB. Backlinks are visible in that referenced verse's UI (who referenced it, link to note).
   - Implement a parser that detects scripture references in typed text (common formats) and normalizes them to canonical IDs.
   - Provide endpoints to fetch backlinks for any verse.

3. Personal Commentaries
   - Users can create personal commentaries that behave like "public commentaries" when toggled public.
   - Users can browse other public user commentaries, and add them to their right-panel list so they appear as commentary sources for quick selection.

4. Account & Notes
   - Signup with email + password, login, logout, session tokens (JWT or server session).
   - Notes linked to account; user can set note scope: private/public. Provide CRUD for notes.
   - No email verification required.

5. Moderation & Safety (basic)
   - Flagging/report endpoint for public commentaries or notes.
   - Rate-limit note creation to prevent spam.
   - Sanitize rendered HTML to avoid XSS.

6. Extras (optional but include skeletons):
   - Export/import notes (JSON/Markdown).
   - Shareable links for public notes.
   - Activity feed: recently published public commentaries and popular notes.
   - API docs (OpenAPI).

Deliverables:
- Project structure + file list.
- DB schema (tables + columns) as SQL or ORM models.
- Key API endpoints with request/response examples.
- Example code for: user signup/login, create/read/update/delete note with backlink extraction, verse fetch, version switch.
- Minimal frontend sample (React) demonstrating the three-panel layout and calling the backend APIs.
- README with setup steps, how to seed a Bible version, and how to run migrations.


Start new project here Build a Python web app (SQLite) that provides a Bible reader with a version selector and a three-panel UI: left—advanced notes editor (per-verse/range), center—Bible text for selected version and chapter, right—commentary selector & viewer. Notes are account-linked (email/password signup; no email verification), can be private or public, and when a note references another scripture (e.g., “see Romans 8:28”) the referenced verse(s) automatically receive a backreference to the note. All the bible versions are in ./bibles json files. Focus first on the version-switching, note creation, backlinking, and public/private note visibility; search users and allow adding public user commentaries as commentary sources.