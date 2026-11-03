import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { registerSW } from 'virtual:pwa-register';

// Register PWA service worker with auto-update and offline capability
registerSW({
  immediate: true,
  onNeedRefresh() {
    // Automatically activate new service worker and refresh
    window.location.reload();
  },
  onOfflineReady() {
    console.info('Finish Pallet Management System siap digunakan dalam Mode Offline.');
  },
});

createRoot(document.getElementById('root')!).render(<App />);
