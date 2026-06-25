import { useState } from 'react';
import { TAG_CSS } from '../data.js';
import { startOfDay, formatDueLabel } from '../utils/dates.js';
import { Dots, LoadBadge, StatusBadge } from './ui/index.jsx';

const DONE_STATUSES = new Set(['done', 'failed', 'saltato']);

function gradeDisplay(exam) {
  if (exam.status !== 'done') return null;
  if (exam.gradeLode) return '30L';
  if (exam.grade != null) return String(exam.grade);
  return null;
}

function getEffectiveDate(exam, datePicks, today) {
  const tod = startOfDay(today);
  // Prefer the soonest AI-picked date for this exam (upcoming only)
  const picks = datePicks.filter((p) => p.examId === exam.id && p.date >= tod);
  if (picks.length > 0) {
    return picks.sort((a, b) => a.date - b.date)[0].date;
  }
  // Fall back to soonest component date
  const allDates = exam.components.flatMap((c) =>
    c.dates.map((d) => ({ ...d }))
  );
  const upcoming = allDates
    .filter((d) => d.date && d.date >= tod)
    .sort((a, b) => a.date - b.date)[0];
  return upcoming?.date ?? null;
}

function ExamCard({ exam, today, selected, planned, datePicks, onClick }) {
  const effDate = getEffectiveDate(exam, datePicks, today);
  const due = effDate
    ? formatDueLabel(effDate, today)
    : { text: 'nessuna data', urgent: false };

  const grade = gradeDisplay(exam);
  const isDone = DONE_STATUSES.has(exam.status);

  return (
    <div
      className={`exam-card ${selected ? 'selected' : ''} ${!planned && !isDone ? 'unplanned' : ''} ${isDone ? 'done' : ''}`}
      style={{ '--tag': TAG_CSS[exam.tag] }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Apri ${exam.name}`}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <span className="tag-bar" />
      {grade && <span className="exam-grade">{grade}</span>}
      <div className="row1">
        <h3>{exam.name}</h3>
        {!isDone && (
          <span className={`due ${due.urgent ? 'urgent' : ''}`}>
            <strong>{due.text}</strong>
          </span>
        )}
        {isDone && exam.status === 'failed' && (
          <span className="due" style={{ color: 'var(--warn)' }}>Non superato</span>
        )}
        {isDone && exam.status === 'saltato' && (
          <span className="due">Saltato</span>
        )}
      </div>
      {!isDone && (
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
      )}
      <div className="footer">
        <StatusBadge status={exam.status} />
        {!isDone && <LoadBadge effort={exam.effort} difficulty={exam.difficulty} />}
      </div>
    </div>
  );
}

export function Sidebar({ exams, studyWindows = [], datePicks = [], today, selectedId, onSelect, onAdd, onImportImage, onHelp, user, onOpenSettings }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('active');
  const plannedIds = new Set(studyWindows.map((w) => w.examId));
  const normalizedQuery = query.trim().toLocaleLowerCase('it');
  const matchesQuery = (exam) => !normalizedQuery
    || exam.name.toLocaleLowerCase('it').includes(normalizedQuery)
    || exam.components.some((component) => component.name.toLocaleLowerCase('it').includes(normalizedQuery));

  const activeExams = exams
    .filter((e) => !DONE_STATUSES.has(e.status) && matchesQuery(e))
    .filter((e) => filter !== 'planned' || plannedIds.has(e.id))
    .slice()
    .sort((a, b) => {
      const da = getEffectiveDate(a, datePicks, today);
      const db = getEffectiveDate(b, datePicks, today);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });

  const doneExams = exams.filter((e) => DONE_STATUSES.has(e.status) && matchesQuery(e));
  const showActive = filter !== 'done';
  const showDone = filter === 'all' || filter === 'done';
  const visibleCount = (showActive ? activeExams.length : 0) + (showDone ? doneExams.length : 0);

  return (
    <aside className="sidebar">
      <div className="sidebar-hd">
        <div className="brand">Sessionly</div>
        <div className="session-tag">Sessione estiva</div>
      </div>

      <div className="sidebar-toolbar">
        <h2>
          Lista esami{' '}
          <span className="sidebar-exam-count">{exams.length}</span>
        </h2>
        <div className="sidebar-toolbar-actions">
          <button
            className="import-img-btn"
            onClick={onHelp}
            title="Come si usa Sessionly"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </button>
          <button
            className="import-img-btn"
            onClick={onImportImage}
            title="Importa esami da screenshot del calendario universitario"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
          </button>
          <button className="add-btn" onClick={onAdd}>
            <span className="plus">+</span>Aggiungi
          </button>
        </div>
      </div>

      {exams.length > 0 && (
        <div className="sidebar-discovery">
          <label className="sidebar-search">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca esame…"
              aria-label="Cerca tra gli esami"
            />
            {query && <button onClick={() => setQuery('')} aria-label="Cancella ricerca">×</button>}
          </label>
          <div className="sidebar-filters" role="group" aria-label="Filtra esami">
            {[
              ['active', 'Attivi'],
              ['planned', 'Pianificati'],
              ['done', 'Conclusi'],
              ['all', 'Tutti'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={filter === value ? 'is-active' : ''}
                onClick={() => setFilter(value)}
                aria-pressed={filter === value}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

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
          {showActive && activeExams.map((e) => (
            <ExamCard
              key={e.id}
              exam={e}
              today={today}
              selected={selectedId === e.id}
              planned={plannedIds.has(e.id)}
              datePicks={datePicks}
              onClick={() => onSelect(e.id)}
            />
          ))}

          {showActive && studyWindows.length === 0 && activeExams.length > 0 && doneExams.length === 0 && (
            <div className="sidebar-plan-hint">
              Premi <strong>Piano AI</strong> per pianificare gli esami
            </div>
          )}

          {showDone && doneExams.length > 0 && (
            <>
              <div className="done-separator">
                <span>Completati</span>
              </div>
              {doneExams.map((e) => (
                <ExamCard
                  key={e.id}
                  exam={e}
                  today={today}
                  selected={selectedId === e.id}
                  planned={plannedIds.has(e.id)}
                  datePicks={datePicks}
                  onClick={() => onSelect(e.id)}
                />
              ))}
            </>
          )}
          {visibleCount === 0 && (
            <div className="sidebar-no-results">
              <span>∅</span>
              <strong>Nessun esame trovato</strong>
              <small>Prova a cambiare ricerca o filtro.</small>
            </div>
          )}
        </div>
      )}

      <div className="sidebar-footer">
        <button className="sidebar-account-button" onClick={onOpenSettings}>
          <span className="sidebar-account-avatar">
            {user?.email?.[0]?.toUpperCase() || 'U'}
          </span>
          <span className="sidebar-account-copy">
            <strong>{user?.email || 'Account'}</strong>
            <small>Account e impostazioni</small>
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
