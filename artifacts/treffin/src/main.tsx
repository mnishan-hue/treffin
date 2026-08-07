import { createRoot } from "react-dom/client";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

const apiBase = import.meta.env.VITE_API_BASE_URL;
if (apiBase) {
  setBaseUrl(apiBase.replace(/\/+$/, ""));
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
