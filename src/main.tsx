import './theme/bootstrap';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App';
import { SettingsProvider } from './data/SettingsProvider';
import { AuthProvider } from './data/AuthProvider';
import { SyncProvider } from './data/SyncProvider';
import './styles.css';

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <SettingsProvider>
        <SyncProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </SyncProvider>
      </SettingsProvider>
    </AuthProvider>
  </React.StrictMode>
);
