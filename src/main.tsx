import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import { useBuilderStore } from './store/useBuilderStore';

// Dev-only hook for smoke tests / browser console debugging.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__builderStore = useBuilderStore;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
