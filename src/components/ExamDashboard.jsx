function fmtDateISO(d) {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function effectiveExamDate(exam, datePicks, today) {
  const todayISO = fmtDateISO(today);
  const picked = datePicks
    .filter((p) => p.examId === exam.id && fmtDateISO(p.date) >= todayISO)
    .map((p) => p.date)
    .sort((a, b) => a - b);
  if (picked.length) return picked[0];

  const all = exam.components
    .flatMap((c) => c.dates.map((d) => d.date))
    .filter((date) => date && fmtDateISO(date) >= todayISO)
    .sort((a, b) => a - b);
  return all[0] || null;
}

function daysUntil(date, today) {
  if (!date) return null;
  const diff = Math.ceil((date.getTime() - today.getTime()) / 86400000);
  return diff;
}

function studyCompletion(examId, events) {
  const sessions = events.filter((e) => e.exam_id === examId && e.type === 'study');
  if (sessions.length === 0) return null;
  const done = sessions.filter((e) => e.status === 'completed').length;
  return Math.round((done / sessions.length) * 100);
}

function fmtHM(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function upcomingSessions(examId, events, today) {
  const todayStr = fmtDateISO(today);
  return events
    .filter((e) => e.exam_id === examId && e.type === 'study'
      && e.status !== 'completed' && fmtDateISO(new Date(e.start_time)) >= todayStr)
    .sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .slice(0, 2)
    .map((e) => {
      const s = new Date(e.start_time);
      const en = new Date(e.end_time);
      return { start: s, startTime: fmtHM(s), endTime: fmtHM(en), label: e.notes || '' };
    });
}

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function fmtDate(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

export function ExamDashboard({ exams, events = [], datePicks, today, onSelectExam }) {
  const sortedExams = [...exams].sort((a, b) => {
    const da = effectiveExamDate(a, datePicks, today);
    const db = effectiveExamDate(b, datePicks, today);
    if (!da && !db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return da - db;
  });

  if (exams.length === 0) {
    return (
      <div style={{ padding: '48px 32px', textAlign: 'center', color: 'var(--ink-soft)' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>📚</div>
        <p>Nessun esame ancora. Aggiungili dalla barra laterale.</p>
      </div>
    );
  }

  return (
    <div className="exam-dashboard">
      <div className="exam-dashboard-grid">
        {sortedExams.map((exam) => {
          const nextDate = effectiveExamDate(exam, datePicks, today);
          const days = daysUntil(nextDate, today);
          const completion = studyCompletion(exam.id, events);
          const sessions = upcomingSessions(exam.id, events, today);

          const urgency = days === null ? 'none' : days < 7 ? 'urgent' : days < 21 ? 'soon' : 'ok';

          return (
            <div key={exam.id} className="exam-card-dashboard">
              <div className="exam-card-hd">
                <span className="exam-tag-chip" style={{ background: `var(--tag-${exam.tag || 'amber'})` }} />
                <h3 className="exam-card-name">{exam.name}</h3>
                <button
                  className="btn ghost"
                  style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 10px' }}
                  onClick={() => onSelectExam(exam.id)}
                >
                  Modifica
                </button>
              </div>

              <div className="exam-card-meta">
                <div className="exam-card-date">
                  <span className="exam-card-date-label">Prossimo esame</span>
                  <span className="exam-card-date-val">
                    {nextDate ? fmtDate(nextDate) : 'Nessuna data futura'}
                  </span>
                </div>
                {days !== null && (
                  <span className={`days-badge days-badge-${urgency}`}>
                    {days === 0 ? 'Oggi!' : days < 0 ? `${Math.abs(days)}g fa` : `${days} giorni`}
                  </span>
                )}
              </div>

              {completion !== null && (
                <div className="exam-card-progress">
                  <div className="exam-card-progress-label">
                    <span>Studio completato</span>
                    <span>{completion}%</span>
                  </div>
                  <div className="exam-card-progress-bar">
                    <div className="exam-card-progress-fill" style={{ width: `${completion}%` }} />
                  </div>
                </div>
              )}

              {sessions.length > 0 && (
                <div className="exam-card-sessions">
                  <div className="exam-card-sessions-label">Prossime sessioni</div>
                  {sessions.map((s, i) => (
                    <div key={i} className="exam-card-session-row">
                      <span>{fmtDate(s.start instanceof Date ? s.start : new Date(s.start))}</span>
                      {s.startTime && (
                        <span style={{ color: 'var(--ink-soft)', fontSize: 12 }}>
                          {s.startTime}–{s.endTime}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
