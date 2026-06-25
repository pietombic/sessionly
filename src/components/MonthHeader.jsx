import { useState } from 'react';
import { MONTHS_IT } from '../utils/dates.js';

function weekRangeTitle(weekStart) {
  const weekEnd = new Date(weekStart.getTime() + 6 * 86400000);
  const s = weekStart.getDate();
  const e = weekEnd.getDate();
  const sm = MONTHS_IT[weekStart.getMonth()];
  const em = MONTHS_IT[weekEnd.getMonth()];
  if (weekStart.getMonth() !== weekEnd.getMonth()) return `${s} ${sm} – ${e} ${em}`;
  return `${s}–${e} ${sm}`;
}

export function MonthHeader({
  year, month, weekStart,
  onPrev, onNext, onToday,
  view, onView,
  onAIPlan, aiLoading,
  hasPlan, onRemovePlan,
  showAllDates, onToggleAllDates,
  onExport,
  workspaceView, onWorkspaceView,
  onNewExam, onNewSession,
}) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isWeek = view === 'week' && weekStart;
  const isCalendar = workspaceView === 'calendar';
  const titleText = isWeek ? weekRangeTitle(weekStart) : MONTHS_IT[month];
  const titleYear = isWeek ? weekStart.getFullYear() : year;
  const headings = {
    today: ['Oggi', 'Priorità, sessioni e prossimo esame in un’unica vista.'],
    exams: ['I tuoi esami', 'Scadenze, urgenza e avanzamento della sessione.'],
  };

  return (
    <div className="main-hd">
      <div className="main-hd-top">
        <div className="titles">
          <h1>
            {isCalendar ? titleText : headings[workspaceView][0]}
            {isCalendar && <span className="year">{titleYear}</span>}
          </h1>
          <div className="sub">
            {isCalendar
              ? 'Organizza sessioni, appelli e giornate di studio.'
              : headings[workspaceView][1]}
          </div>
        </div>

        <div className="main-primary-actions" aria-label="Azioni principali">
          <button className="tb-btn" onClick={onNewExam} title="Aggiungi un nuovo esame">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Esame
          </button>
          <button className="tb-btn" onClick={onNewSession} title="Crea sessioni di studio">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="12" y1="14" x2="12" y2="18" /><line x1="10" y1="16" x2="14" y2="16" />
            </svg>
            Sessione
          </button>
          <button
            className={`ai-btn ${aiLoading ? 'loading' : ''}`}
            onClick={onAIPlan}
            disabled={aiLoading}
            title="Genera piano di studio con Groq AI"
          >
            <span>{aiLoading ? '⟳' : '✦'}</span>
            {aiLoading ? 'Generazione...' : 'Piano AI'}
          </button>
        </div>
      </div>

      <div className="main-toolbar">
        <div className="main-toolbar-start">
          {isCalendar && (
            <div className="nav">
              <button className="today-btn" onClick={onToday}>Oggi</button>
              <button className="nav-btn" aria-label={isWeek ? 'Settimana precedente' : 'Mese precedente'} onClick={onPrev}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              <button className="nav-btn" aria-label={isWeek ? 'Settimana successiva' : 'Mese successivo'} onClick={onNext}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M5 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          )}

          {isCalendar && (
            <div className="seg" role="group" aria-label="Visualizzazione calendario">
            <button className={`seg-btn ${view === 'month' ? 'on' : ''}`} onClick={() => onView('month')} title="Vista mensile">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="10" x2="9" y2="22" /><line x1="15" y1="10" x2="15" y2="22" />
              </svg>
              Mese
            </button>
            <button className={`seg-btn ${view === 'week' ? 'on' : ''}`} onClick={() => onView('week')} title="Vista settimanale">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="9" y1="4" x2="9" y2="22" /><line x1="15" y1="4" x2="15" y2="22" />
              </svg>
              Settimana
            </button>
            </div>
          )}
        </div>

        <div className="main-toolbar-end">
          <div className="seg" role="group" aria-label="Sezione">
            <button
              className={`seg-btn ${workspaceView === 'today' ? 'on' : ''}`}
              onClick={() => onWorkspaceView('today')}
              title="Mostra il riepilogo di oggi"
            >
              Oggi
            </button>
            <button
              className={`seg-btn ${workspaceView === 'calendar' ? 'on' : ''}`}
              onClick={() => onWorkspaceView('calendar')}
              title="Mostra il calendario"
            >
              Calendario
            </button>
            <button
              className={`seg-btn ${workspaceView === 'exams' ? 'on' : ''}`}
              onClick={() => onWorkspaceView('exams')}
              title="Mostra solo gli esami"
            >
              Esami
            </button>
          </div>

          {hasPlan && isCalendar && (
            <button
              className={`show-all-btn ${showAllDates ? 'on' : ''}`}
              onClick={onToggleAllDates}
              title={showAllDates ? 'Mostra solo date del piano' : 'Mostra tutte le date degli esami'}
            >
              {showAllDates ? 'Solo piano' : 'Tutte le date'}
            </button>
          )}

          <button className="export-btn" onClick={onExport} title="Esporta su Apple Calendar o Google Calendar">
            Esporta
          </button>

          {hasPlan && !confirmRemove && (
            <button className="remove-plan-btn" onClick={() => setConfirmRemove(true)} title="Rimuovi il piano AI">
              Rimuovi piano
            </button>
          )}

          {hasPlan && confirmRemove && (
            <div className="delete-confirm-row">
              <span className="delete-confirm-text">Rimuovere?</span>
              <button className="btn danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => { setConfirmRemove(false); onRemovePlan(); }}>Sì</button>
              <button className="btn ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setConfirmRemove(false)}>No</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
