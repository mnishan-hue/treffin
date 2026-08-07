import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiBase = import.meta.env.VITE_API_BASE_URL;
if (apiBase) {
  setBaseUrl(apiBase.replace(/\/+$/, ""));

  // Wake up the Render service immediately on page load so it's ready by the
  // time the user's first real API call fires. Render's free/starter tier spins
  // the service down after 15 min of inactivity; the cold-start takes ~30 s.
  // A fire-and-forget ping to /health keeps that cost from hitting the user.
  fetch(`${apiBase.replace(/\/+$/, "")}/health`, { method: "GET", credentials: "omit" }).catch(() => {});
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Use BASE_URL so this works both in Replit (subpath) and production (root)
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch((err) => console.warn("[sw] registration failed", err));
  });
}

createRoot(document.getElementById("root")!).render(<App />);
