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
    throw new Error(message || "Request failed");
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
  fetchSubscriptions() {
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
  }
};
