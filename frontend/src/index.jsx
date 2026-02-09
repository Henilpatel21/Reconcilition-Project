import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './index.css';

try {
  createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
  window.__REACT_MOUNTED__ = true;
} catch (err) {
  // record error for debugging
  try { window.__REACT_ERROR__ = String(err); } catch (_) {}
  throw err;
}
