import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { inject } from '@vercel/analytics';
import './styles.css';
import './styles/dashboard.css';
import './styles/interactions.css';
import './styles/notifications.css';
import './styles/accessibility.css';
import App from './App.jsx';

inject();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
