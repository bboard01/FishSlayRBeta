import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { DataProvider } from './lib/DataContext.jsx';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </React.StrictMode>
);

// Register the PWA service worker for offline app-shell caching. The URL and
// scope are built from Vite's BASE_URL so they resolve under the GitHub Pages
// sub-path (/FishSlayRBeta/) rather than the domain root. Registered after load
// so it never competes with the initial render. Dev (import.meta.env.DEV) skips
// it to avoid caching a stale bundle during local work.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const base = import.meta.env.BASE_URL; // e.g. "/FishSlayRBeta/"
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(`${base}service-worker.js`, { scope: base })
      .catch((err) => console.warn('[sw] registration failed', err));
  });
}
