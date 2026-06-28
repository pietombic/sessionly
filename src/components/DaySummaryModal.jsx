import { useDialog } from '../hooks/useDialog.js';

function fmtDate(date) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function DaySummaryModal({ summary, onOpenEvent, onClose }) {
  const dialogRef = useDialog(onClose);
  if (!summary) return null;
  const count = summary.events.length + summary.studies.length;

  return (
    <div className="modal-backdrop" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal modal--compact day-summary-modal" role="dialog" aria-modal="true" aria-labelledby="day-summary-title">
        <div className="modal-hd">
          <div>
            <span className="modal-eyebrow">Riepilogo giornata</span>
            <h2 id="day-summary-title">{fmtDate(summary.date)}</h2>
            <div className="sub">{count ? `${count} elementi in calendario` : 'Nessun elemento'}</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>
        <div className="modal-body day-summary-body">
          {count === 0 && <div className="day-summary-empty">La giornata è libera.</div>}

          {summary.studies.length > 0 && (
            <section>
              <h3>Sessioni di studio</h3>
              <div className="day-summary-list">
                {summary.studies.map((session) => (
                  <button
                    key={session.id}
                    className="day-summary-item"
                    onClick={() => onOpenEvent({
                      type: 'session',
                      eventId: session.id,
                      examName: session.exam.name,
                      title: session.title || session.exam.name,
                      notes: session.notes || '',
                      completed: session.completed,
                      startTime: session.startTime,
                      endTime: session.endTime,
                      startISO: session.startISO,
                      endISO: session.endISO,
                    })}
                  >
                    <span className="day-summary-time">{session.startTime}–{session.endTime}</span>
                    <span>
                      <strong>{session.title || session.exam.name}</strong>
                      <small>
                        {session.title && session.title !== session.exam.name
                          ? `${session.exam.name} · `
                          : ''}
                        {session.completed ? 'Completata' : 'Pianificata'}
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {summary.events.length > 0 && (
            <section>
              <h3>Esami e appelli</h3>
              <div className="day-summary-list">
                {summary.events.map((entry, index) => (
                  <button
                    key={`${entry.exam.id}-${entry.component}-${index}`}
                    className="day-summary-item"
                    onClick={() => onOpenEvent({
                      type: 'exam',
                      examId: entry.exam.id,
                      examName: entry.exam.name,
                      componentName: entry.component,
                      date: entry.date.date,
                      time: entry.date.time || '',
                      room: entry.date.room || '',
                      locked: entry.date.locked || false,
                    })}
                  >
                    <span className="day-summary-time">{entry.date.time || 'Esame'}</span>
                    <span>
                      <strong>{entry.exam.name}</strong>
                      <small>{entry.component}{entry.date.room ? ` · ${entry.date.room}` : ''}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
