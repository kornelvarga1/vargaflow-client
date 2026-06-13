import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerServiceWorker } from "./hooks/usePushNotifications";

createRoot(document.getElementById("root")!).render(<App />);

// Register service worker on load (non-blocking)
registerServiceWorker();

// iOS PWA keyboard fix: keep --app-height in sync with the actual visible
// viewport so fixed/flex containers shrink when the software keyboard opens.
function syncAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${h}px`);
}
window.visualViewport?.addEventListener("resize", syncAppHeight);
window.visualViewport?.addEventListener("scroll", syncAppHeight);
syncAppHeight();
