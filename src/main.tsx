import React from "react";
import ReactDOM from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import App from "./App";

if (isTauri() && /Macintosh|Mac OS X/.test(navigator.userAgent)) {
  document.documentElement.classList.add("mac-custom-window");
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
