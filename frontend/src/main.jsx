import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./components/Layout.css";

// Global click handler: open verse when clicking <a rel="ref" title="Book Chapter:Verse[-End]">
function installRefLinkHandler() {
  if (window.__refLinkHandlerInstalled) return;
  window.__refLinkHandlerInstalled = true;
  document.addEventListener("click", (e) => {
    const path = e.composedPath ? e.composedPath() : [];
    let a = null;
    for (const el of path) {
      if (el && el.tagName === "A" && el.getAttribute && el.getAttribute("rel") === "ref") {
        a = el; break;
      }
    }
    if (!a) return;
    e.preventDefault();
    const title = a.getAttribute("title") || a.textContent || "";
    // Accept formats like "Romans 1:2" or "1 Corinthians 5:7-8"
    const m = title.match(/^\s*(.+?)\s+(\d+):(\d+)/);
    if (!m) return;
    const book = m[1];
    const chapter = Number(m[2]);
    const verse = Number(m[3]);
    if (!book || !chapter || !verse) return;
    try {
      window.dispatchEvent(new CustomEvent("open-verse", { detail: { book, chapter, verse } }));
    } catch {}
  });
}

installRefLinkHandler();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
