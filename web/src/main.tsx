import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";
import "./index.css";
import { markFleetFrame } from "./lib/fleet-frame";
// Registers the service worker (precaches the app shell, enables install) and wires auto/manual
// updates. Guards on `serviceWorker in navigator`, so over plain HTTP (insecure context) it no-ops.
import "./lib/pwa";

markFleetFrame(document.documentElement, window.parent !== window);

const root = document.getElementById("root");
if (!root) throw new Error("missing #root");

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
