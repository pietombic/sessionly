import { useState, useRef, useEffect } from 'react';
import { MONTHS_IT } from '../utils/dates.js';

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const initial = (user.email?.[0] || '?').toUpperCase();

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        className="user-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        title={user.email}
        aria-label="Menu utente"
      >
        {initial}
      </button>
      {open && (
        <div className="user-menu">
          <div className="user-menu-email">{user.email}</div>
          <button
            className="user-menu-btn"
            onClick={() => { setOpen(false); onLogout(); }}
          >
            Esci
          </button>
        </div>
      )}
    </div>
  );
}

export function MonthHeader({
  year, month, onPrev, onNext, onToday,
  view, onView,
  onAIPlan, aiLoading,
  onExport,
  user, onLogout,
}) {
  return (
    <div className="main-hd">
      <div className="titles">
        <h1>
          {MONTHS_IT[month]}
          <span className="year">{year}</span>
        </h1>
        <div className="sub">
          La tua sessione, giorno per giorno. <em>Coraggio.</em>
        </div>
      </div>

      <div className="main-hd-actions">
        <button
          className={`ai-btn ${aiLoading ? 'loading' : ''}`}
          onClick={onAIPlan}
          disabled={aiLoading}
          title="Genera piano di studio con Groq AI"
        >
          <span>{aiLoading ? '⟳' : '✦'}</span>
          {aiLoading ? 'Generazione...' : 'Piano AI'}
        </button>

        <button
          className="export-btn"
          onClick={onExport}
          title="Esporta su Apple Calendar o Google Calendar"
        >
          <span>⬆</span>
          Esporta
        </button>

        <div className="nav">
          <button className="today-btn" onClick={onToday}>Oggi</button>
          <button className="nav-btn" aria-label="Mese precedente" onClick={onPrev}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button className="nav-btn" aria-label="Mese successivo" onClick={onNext}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        <div className="view-toggle">
          <button className={view === 'month' ? 'on' : ''} onClick={() => onView('month')}>Mese</button>
          <button className={view === 'week' ? 'on' : ''} onClick={() => onView('week')}>Settimana</button>
        </div>

        {user && <UserMenu user={user} onLogout={onLogout} />}
      </div>
    </div>
  );
}
