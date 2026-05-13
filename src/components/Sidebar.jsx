import { TAG_CSS } from '../data.js';
import { startOfDay, formatDueLabel } from '../utils/dates.js';
import { Dots, LoadBadge, StatusBadge } from './ui/index.jsx';

function ExamCard({ exam, today, selected, onClick }) {
  const allDates = exam.components.flatMap((c) =>
    c.dates.map((d) => ({ ...d, component: c.name }))
  );
  const upcoming = allDates
    .filter((d) => d.date && d.date >= startOfDay(today))
    .sort((a, b) => a.date - b.date)[0];

  const due = upcoming
    ? formatDueLabel(upcoming.date, today)
    : { text: 'nessuna data', urgent: false };

  return (
    <div
      className={`exam-card ${selected ? 'selected' : ''}`}
      style={{ '--tag': TAG_CSS[exam.tag] }}
      onClick={onClick}
    >
      <span className="tag-bar" />
      <div className="row1">
        <h3>{exam.name}</h3>
        <span className={`due ${due.urgent ? 'urgent' : ''}`}>
          {upcoming?.locked ? '🔒 ' : ''}
          <strong>{due.text}</strong>
        </span>
      </div>
      <div className="meta">
        <span className="metric">
          <span className="lbl">Eff</span>
          <Dots value={exam.effort} variant="accent" />
        </span>
        <span className="metric">
          <span className="lbl">Diff</span>
          <Dots value={exam.difficulty} variant={exam.difficulty >= 8 ? 'warn' : ''} />
        </span>
      </div>
      <div className="footer">
        <StatusBadge status={exam.status} />
        <LoadBadge effort={exam.effort} difficulty={exam.difficulty} />
      </div>
    </div>
  );
}

export function Sidebar({ exams, today, selectedId, onSelect, onAdd }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-hd">
        <div className="brand">Sessionly</div>
        <div className="session-tag">Sessione estiva</div>
      </div>

      <div className="sidebar-toolbar">
        <h2>
          Lista esami{' '}
          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--ink-soft)', marginLeft: 6 }}>
            · {exams.length}
          </span>
        </h2>
        <button className="add-btn" onClick={onAdd}>
          <span className="plus">+</span>Aggiungi
        </button>
      </div>

      {exams.length === 0 ? (
        <div className="sidebar-empty">
          <span className="glyph">∅</span>
          <div>Nessun esame ancora.</div>
          <div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
            Premi <em>"Aggiungi"</em> per iniziare a costruire la tua sessione.
          </div>
        </div>
      ) : (
        <div className="exam-list scroll">
          {exams.map((e) => (
            <ExamCard
              key={e.id}
              exam={e}
              today={today}
              selected={selectedId === e.id}
              onClick={() => onSelect(e.id)}
            />
          ))}
        </div>
      )}

      <div style={{
        padding: '12px 22px',
        borderTop: '1px solid var(--rule)',
        flexShrink: 0,
      }}>
        <a
          href="https://github.com/pietombic/"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontFamily: 'var(--mono)',
            fontSize: 10,
            letterSpacing: '0.06em',
            color: 'var(--ink-soft)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            transition: 'color .12s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--ink)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--ink-soft)'}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ flexShrink: 0 }}>
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Pietro Tombaccini · pietombic
        </a>
      </div>
    </aside>
  );
}
