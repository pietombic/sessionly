import { useMemo } from 'react';
import { TAG_CSS } from '../data.js';

const DAY_MS = 86400000;

function sameCalendarDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function startOfWeek(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fmtTime(date) {
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function fmtDate(date) {
  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

function getUpcomingExam(exams, datePicks, today) {
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const candidates = [];

  exams
    .filter((exam) => !['done', 'failed', 'saltato'].includes(exam.status))
    .forEach((exam) => {
      const picked = datePicks.filter((pick) => pick.examId === exam.id);
      const source = picked.length
        ? picked.map((pick) => ({ date: pick.date, component: pick.componentName }))
        : exam.components.flatMap((component) =>
            component.dates.map((entry) => ({ date: entry.date, component: component.name }))
          );
      source.forEach((entry) => {
        const date = entry.date instanceof Date ? entry.date : new Date(entry.date);
        if (!Number.isNaN(date.getTime()) && date >= todayStart) {
          candidates.push({ exam, date, component: entry.component });
        }
      });
    });

  return candidates.sort((a, b) => a.date - b.date)[0] || null;
}

export function TodayDashboard({
  exams,
  events,
  datePicks,
  today,
  onOpenSession,
  onNewSession,
  onOpenExam,
  onOpenCalendar,
}) {
  const stats = useMemo(() => {
    const now = new Date(today);
    const weekStart = startOfWeek(now);
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS);
    const studyEvents = events
      .filter((event) => event.type === 'study')
      .map((event) => ({
        ...event,
        start: new Date(event.start_time),
        end: new Date(event.end_time),
      }))
      .filter((event) => !Number.isNaN(event.start.getTime()));

    const todayEvents = studyEvents
      .filter((event) => sameCalendarDay(event.start, now))
      .sort((a, b) => a.start - b.start);
    const weekEvents = studyEvents.filter((event) => event.start >= weekStart && event.start < weekEnd);
    const plannedMinutes = weekEvents.reduce(
      (sum, event) => sum + Math.max(0, (event.end - event.start) / 60000),
      0
    );
    const completedMinutes = weekEvents
      .filter((event) => event.status === 'completed')
      .reduce((sum, event) => sum + Math.max(0, (event.end - event.start) / 60000), 0);

    return {
      todayEvents,
      plannedMinutes,
      completedMinutes,
      progress: plannedMinutes ? Math.round((completedMinutes / plannedMinutes) * 100) : 0,
      nextExam: getUpcomingExam(exams, datePicks, now),
    };
  }, [events, exams, datePicks, today]);

  const examById = useMemo(() => new Map(exams.map((exam) => [exam.id, exam])), [exams]);
  const daysToExam = stats.nextExam
    ? (() => {
        const examDate = new Date(stats.nextExam.date);
        const currentDate = new Date(today);
        examDate.setHours(0, 0, 0, 0);
        currentDate.setHours(0, 0, 0, 0);
        return Math.max(0, Math.ceil((examDate - currentDate) / DAY_MS));
      })()
    : null;

  return (
    <section className="today-dashboard" aria-labelledby="today-heading">
      <div className="today-hero">
        <div>
          <span className="today-kicker">La tua giornata</span>
          <h2 id="today-heading">{fmtDate(new Date(today))}</h2>
          <p>
            {stats.todayEvents.length
              ? `${stats.todayEvents.length} session${stats.todayEvents.length === 1 ? 'e' : 'i'} pianificat${stats.todayEvents.length === 1 ? 'a' : 'e'} oggi.`
              : 'Non hai sessioni pianificate per oggi.'}
          </p>
        </div>
        <div className="today-actions">
          <button className="btn ghost" onClick={onOpenCalendar}>Apri calendario</button>
          <button className="btn" onClick={onNewSession}>+ Nuova sessione</button>
        </div>
      </div>

      <div className="today-metrics">
        <article className="today-metric-card">
          <span className="today-card-label">Prossimo esame</span>
          {stats.nextExam ? (
            <button className="today-exam-link" onClick={() => onOpenExam(stats.nextExam.exam.id)}>
              <strong>{stats.nextExam.exam.name}</strong>
              <span>{stats.nextExam.component} · {fmtDate(stats.nextExam.date)}</span>
              <small>{daysToExam === 0 ? 'Oggi' : `Tra ${daysToExam} giorn${daysToExam === 1 ? 'o' : 'i'}`}</small>
            </button>
          ) : (
            <p className="today-empty-copy">Nessuna data futura disponibile.</p>
          )}
        </article>

        <article className="today-metric-card">
          <span className="today-card-label">Questa settimana</span>
          <strong className="today-big-number">
            {Math.round(stats.completedMinutes / 60 * 10) / 10}
            <small>h completate</small>
          </strong>
          <div className="today-progress" aria-label={`Progresso settimanale ${stats.progress}%`}>
            <span style={{ width: `${stats.progress}%` }} />
          </div>
          <span className="today-progress-copy">
            {stats.progress}% di {Math.round(stats.plannedMinutes / 60 * 10) / 10} ore pianificate
          </span>
        </article>
      </div>

      <div className="today-schedule">
        <div className="today-section-heading">
          <div>
            <span className="today-card-label">Agenda</span>
            <h3>Sessioni di oggi</h3>
          </div>
        </div>

        {stats.todayEvents.length === 0 ? (
          <div className="today-empty-state">
            <span aria-hidden="true">○</span>
            <div>
              <strong>Giornata libera</strong>
              <p>Aggiungi una sessione oppure controlla il resto della settimana.</p>
            </div>
          </div>
        ) : (
          <div className="today-session-list">
            {stats.todayEvents.map((event) => {
              const exam = examById.get(event.exam_id);
              const completed = event.status === 'completed';
              return (
                <button
                  key={event.id}
                  className={`today-session ${completed ? 'is-completed' : ''}`}
                  style={{ '--tag': TAG_CSS[exam?.tag] || 'var(--accent)' }}
                  onClick={() => onOpenSession({
                    type: 'session',
                    eventId: event.id,
                    examName: exam?.name || 'Sessione di studio',
                    title: event.title || exam?.name || 'Sessione di studio',
                    notes: event.notes || '',
                    completed,
                    startTime: fmtTime(event.start),
                    endTime: fmtTime(event.end),
                    startISO: event.start.toISOString(),
                    endISO: event.end.toISOString(),
                  })}
                >
                  <span className="today-session-time">
                    {fmtTime(event.start)}
                    <small>{fmtTime(event.end)}</small>
                  </span>
                  <span className="today-session-marker" aria-hidden="true" />
                  <span className="today-session-copy">
                    <strong>{event.title || exam?.name || 'Studio'}</strong>
                    <small>{completed ? 'Completata' : 'Sessione di studio'}</small>
                  </span>
                  <span className="today-session-arrow" aria-hidden="true">→</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
