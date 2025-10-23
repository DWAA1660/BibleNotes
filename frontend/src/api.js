const BASE_URL = "/api";
let authToken = null;

export function setToken(token) {
  authToken = token;
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("Accept", "application/json");
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      if (data && data.detail) {
        message = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
      }
    } catch {}
    const error = new Error(message || "Request failed");
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

export const api = {
  fetchVersions() {
    return request("/bible/versions");
  },
  fetchChapter(version, book, chapter) {
    return request(`/bible/${encodeURIComponent(version)}/${encodeURIComponent(book)}/${chapter}`);
  },
  fetchNotes(version, book, chapter) {
    return request(`/notes/${encodeURIComponent(version)}/${encodeURIComponent(book)}/${chapter}`);
  },
  fetchPublicAuthors(params = {}) {
    const query = new URLSearchParams();
    if (params.version) {
      query.set("version_code", params.version);
    }
    if (params.book) {
      query.set("book", params.book);
    }
    if (params.chapter) {
      query.set("chapter", params.chapter);
    }
    if (params.query) {
      query.set("query", params.query);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/notes/authors/public${suffix}`);
  },
  searchAuthors(query) {
    const term = query?.trim();
    const suffix = term ? `?query=${encodeURIComponent(term)}` : "";
    return request(`/notes/authors/public${suffix}`);
  },
  fetchAuthorNotes(authorId) {
    return request(`/notes/authors/${authorId}`);
  },
  fetchNoteSubscriptions() {
    return request("/notes/subscriptions");
  },
  subscribeAuthor(authorId) {
    return request(`/notes/subscriptions/${authorId}`, {
      method: "POST"
    });
  },
  unsubscribeAuthor(authorId) {
    return request(`/notes/subscriptions/${authorId}`, {
      method: "DELETE"
    });
  },
  fetchUserSubscriptions(userId) {
    return request(`/users/${userId}/subscriptions`);
  },
  fetchSubscribedNotes(params = {}) {
    const query = new URLSearchParams();
    if (params.version) {
      query.set("version_code", params.version);
    }
    if (params.book) {
      query.set("book", params.book);
    }
    if (params.chapter) {
      query.set("chapter", params.chapter);
    }
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/notes/subscriptions/notes${suffix}`);
  },
  signup(payload) {
    return request("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  login(payload) {
    return request("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  createNote(payload) {
    return request("/notes", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  fetchCommentarySubscriptions() {
    return request("/commentaries/subscriptions");
  },
  fetchPublicCommentaries(query) {
    const url = query ? `/commentaries/public?query=${encodeURIComponent(query)}` : "/commentaries/public";
    return request(url);
  },
  subscribeCommentary(commentaryId) {
    return request(`/commentaries/${commentaryId}/subscribe`, {
      method: "POST"
    });
  },
  fetchCommentaryEntries(commentaryId, verseId) {
    const url = verseId
      ? `/commentaries/${commentaryId}/entries?verse_id=${verseId}`
      : `/commentaries/${commentaryId}/entries`;
    return request(url);
  },
  fetchMe() {
    return request("/auth/me");
  },
  updateNote(noteId, payload) {
    return request(`/notes/${noteId}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  fetchMyNotes() {
    return request("/notes/me");
  },
  deleteNote(noteId) {
    return request(`/notes/${noteId}`, {
      method: "DELETE"
    });
  },
  fetchMyProfile() {
    return request("/users/me/profile");
  },
  searchUsers(query) {
    const term = query?.trim();
    const suffix = term ? `?query=${encodeURIComponent(term)}` : "";
    return request(`/users/search${suffix}`);
  },
  fetchManuscriptEditions(params = {}) {
    const query = new URLSearchParams();
    if (params.language) query.set("language", params.language);
    if (params.scope) query.set("scope", params.scope);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/manuscripts/editions${suffix}`);
  },
  fetchManuscriptsAvailable(book, chapter, params = {}) {
    const query = new URLSearchParams();
    if (params.language) query.set("language", params.language);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request(`/manuscripts/available/${encodeURIComponent(book)}/${chapter}${suffix}`);
  },
  fetchManuscriptChapter(edition, book, chapter) {
    return request(`/manuscripts/${encodeURIComponent(edition)}/${encodeURIComponent(book)}/${chapter}`);
  }
};
