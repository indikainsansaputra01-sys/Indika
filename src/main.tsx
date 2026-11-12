import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Register PWA service worker with auto-update in production
if (import.meta.env.PROD) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          window.location.reload();
        },
        onOfflineReady() {
          console.info('Finish Pallet Management System siap digunakan dalam Mode Offline.');
        },
      });
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(<App />);
