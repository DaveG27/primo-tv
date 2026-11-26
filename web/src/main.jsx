import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app';
import { applyAppearance } from './theme.js';

applyAppearance();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
