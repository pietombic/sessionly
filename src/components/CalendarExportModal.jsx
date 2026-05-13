import { downloadICS, googleCalendarURL, getAllEvents, formatShortDate } from '../utils/calendarExport.js';
import { TAG_CSS } from '../data.js';

export function CalendarExportModal({ exams, onClose }) {
  const events = getAllEvents(exams);

  const handleDownloadICS = () => {
    downloadICS(exams);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal export-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h2>Esporta Calendario</h2>
            <div className="sub">Salva gli esami su Apple Calendar o Google Calendar.</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body scroll">
          <div className="export-cards">
            {/* Apple Calendar */}
            <div className="export-card">
              <div className="export-card-icon">🍎</div>
              <h3>Apple Calendar</h3>
              <p>
                Scarica un file .ics con tutti gli esami. Aprilo per importarli
                direttamente in Calendar su Mac o iPhone.
              </p>
              <button className="btn" onClick={handleDownloadICS} style={{ marginTop: 4 }}>
                Scarica .ics
              </button>
            </div>

            {/* Google Calendar */}
            <div className="export-card">
              <div className="export-card-icon">📅</div>
              <h3>Google Calendar</h3>
              <p>
                Aggiungi ogni esame singolarmente cliccando il link corrispondente.
                Si aprirà la pagina di creazione evento pre-compilata.
              </p>
              <span style={{
                fontFamily: 'var(--mono)',
                fontSize: 10,
                color: 'var(--ink-soft)',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}>
                {events.length} {events.length === 1 ? 'evento' : 'eventi'} sotto ↓
              </span>
            </div>
          </div>

          {/* Google Calendar event list */}
          {events.length > 0 && (
            <>
              <div className="export-section-label">Aggiungi a Google Calendar</div>
              <div className="export-event-list scroll">
                {events.map(({ exam, comp, dt }, i) => {
                  const url = googleCalendarURL(exam, comp, dt);
                  return (
                    <div
                      key={i}
                      className="export-event-row"
                      style={{ borderLeftColor: TAG_CSS[exam.tag], borderLeftWidth: 3, borderLeftStyle: 'solid' }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span className="ev-name">{exam.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--ink-soft)', fontFamily: 'var(--mono)' }}>
                          {comp.name}{dt.locked ? ' 🔒' : ''}
                        </span>
                      </div>
                      <span className="ev-date">{formatShortDate(dt.date)}{dt.time ? ` · ${dt.time}` : ''}</span>
                      {url && (
                        <a
                          className="ev-link"
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Aggiungi
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {events.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '24px 0',
              color: 'var(--ink-soft)',
              fontSize: 13,
            }}>
              Nessun evento con date inserite.
            </div>
          )}
        </div>

        <div className="modal-ft">
          <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>
            {exams.length} {exams.length === 1 ? 'esame' : 'esami'} · {events.length} {events.length === 1 ? 'data' : 'date'}
          </span>
          <button className="btn ghost" onClick={onClose}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}
