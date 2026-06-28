import { useMemo } from 'react';
import { TAG_CSS } from '../data.js';
import { WEEKDAYS_IT, monthGrid, sameDay, formatLongDate, loadScore } from '../utils/dates.js';
import { useTooltip, Tooltip } from './ui/index.jsx';

function EventChip({ ev, onHover, onMove, onLeave, onClick }) {
  return (
    <div
      className={`chip ${ev.locked ? 'locked' : ''}`}
      style={{ '--tag': TAG_CSS[ev.exam.tag] }}
      onMouseEnter={(e) => onHover(e, ev)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      {ev.locked && <span className="lock">🔒</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span className="ctype" style={{ marginRight: 4 }}>{ev.component}</span>
        {ev.exam.name.split(' ').slice(0, 2).join(' ')}
      </span>
    </div>
  );
}

function StudyBlock({ st, onHover, onMove, onLeave, onClick }) {
  return (
    <div
      className={`study ${st.completed ? 'study-done' : ''}`}
      style={{ '--tag': TAG_CSS[st.exam.tag] }}
      onMouseEnter={(e) => onHover(e, st)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      title={st.completed ? 'Completato · clicca per annullare' : 'Clicca per segnare come completato'}
    >
      <span className="study-color-dot" aria-hidden="true" />
      <span className="stype">{st.completed ? 'Fatto' : 'Studio'}</span>
      <span className="study-name" style={{ textDecoration: st.completed ? 'line-through' : 'none' }}>
        {st.title}
      </span>
    </div>
  );
}

function isPicked(ev, datePicks) {
  if (datePicks.length === 0) return true;
  return datePicks.some(
    (p) => p.examId === ev.exam.id && p.componentName === ev.component && sameDay(p.date, ev.date.date)
  );
}

function buildBuckets(cells, exams, sessions, datePicks, showAllDates) {
  const buckets = new Map();
  for (const c of cells) buckets.set(c.date.toDateString(), { events: [], studies: [] });

  const filterByPlan = datePicks.length > 0 && !showAllDates;

  for (const exam of exams) {
    for (const comp of exam.components) {
      for (const dt of comp.dates) {
        if (!dt.date) continue;
        const ev = { exam, component: comp.name, date: dt, locked: dt.locked };
        if (filterByPlan && !isPicked(ev, datePicks)) continue;
        const key = dt.date.toDateString();
        if (buckets.has(key)) buckets.get(key).events.push(ev);
      }
    }
  }

  // Ogni sessione è una riga `events` indipendente, sul suo giorno reale.
  for (const s of sessions) {
    if (s.type !== 'study') continue;
    const exam = exams.find((e) => e.id === s.exam_id);
    if (!exam) continue;
    const start = new Date(s.start_time);
    const end = new Date(s.end_time);
    const key = start.toDateString();
    if (!buckets.has(key)) continue;
    buckets.get(key).studies.push({
      id: s.id,
      exam,
      title: s.title || exam.name,
      label: s.notes || '',
      notes: s.notes || '',
      completed: s.status === 'completed',
      startTime: `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`,
      endTime: `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}`,
      startISO: start.toISOString(),
      endISO: end.toISOString(),
    });
  }

  return buckets;
}

export function CalendarGrid({ year, month, exams, events = [], datePicks = [], showAllDates = false, today, studyStyle, onSelectExam, onToggleStudyComplete, onOpenEventDetail, onOpenDaySummary }) {
  const allCells = useMemo(() => monthGrid(year, month), [year, month]);
  const buckets = useMemo(
    () => buildBuckets(allCells, exams, events, datePicks, showAllDates),
    [allCells, exams, events, datePicks, showAllDates]
  );
  const { tt, show, move, hide } = useTooltip();

  const showEvent = (e, ev) => show(e, (
    <>
      <h4>{ev.exam.name}</h4>
      <div className="ttline"><span className="l">Componente</span><span>{ev.component}</span></div>
      <div className="ttline">
        <span className="l">Data</span>
        <span>{formatLongDate(ev.date.date)}{ev.date.time && ` · ${ev.date.time}`}</span>
      </div>
      {ev.date.room && <div className="ttline"><span className="l">Sede</span><span>{ev.date.room}</span></div>}
      {ev.locked && <div className="ttline"><span className="l">🔒</span><span>Data bloccata</span></div>}
    </>
  ));

  const showStudy = (e, st) => show(e, (
    <>
      <h4>{st.title}</h4>
      {st.title !== st.exam.name && <div className="ttline"><span className="l">Esame</span><span>{st.exam.name}</span></div>}
      {st.label && <div className="ttline"><span className="l">Note</span><span>{st.label}</span></div>}
      <div className="ttline">
        <span className="l">Carico</span>
        <span>{loadScore(st.exam.effort, st.exam.difficulty).label}</span>
      </div>
      {st.completed && <div className="ttline"><span className="l">✓</span><span>Completato</span></div>}
    </>
  ));

  return (
    <div className={`cal-wrap study-style-${studyStyle}`}>
      <div className="cal-weekrow">
        {WEEKDAYS_IT.map((wd) => <div key={wd} className="wd">{wd}</div>)}
      </div>
      <div className="cal-grid">
        {allCells.map((c, i) => {
          const key = c.date.toDateString();
          const b = buckets.get(key) || { events: [], studies: [] };
          const isToday = sameDay(c.date, today);
          const examsHere = new Set(b.events.map((e) => e.exam.id));
          const conflict = examsHere.size >= 2;

          const studies = b.studies;

          const allChildren = [
            ...b.events.map((ev, idx) => (
              <EventChip
                key={'e' + idx}
                ev={ev}
                onHover={showEvent}
                onMove={move}
                onLeave={hide}
                onClick={() => onOpenEventDetail
                  ? onOpenEventDetail({
                      type: 'exam',
                      examId: ev.exam.id,
                      examName: ev.exam.name,
                      componentName: ev.component,
                      date: ev.date.date,
                      time: ev.date.time || '',
                      room: ev.date.room || '',
                      locked: ev.date.locked || false,
                    })
                  : onSelectExam(ev.exam.id)}
              />
            )),
            ...studies.map((st, idx) => (
              <StudyBlock
                key={'s' + idx}
                st={st}
                onHover={showStudy}
                onMove={move}
                onLeave={hide}
                onClick={() => {
                  if (onOpenEventDetail) {
                    onOpenEventDetail({
                      type: 'session',
                      eventId: st.id,
                      examName: st.exam.name,
                      title: st.title,
                      label: st.label || '',
                      notes: st.notes || '',
                      completed: st.completed,
                      startTime: st.startTime,
                      endTime: st.endTime,
                      startISO: st.startISO,
                      endISO: st.endISO,
                    });
                  } else {
                    onToggleStudyComplete?.(st.id);
                  }
                }}
              />
            )),
          ];

          const visible = allChildren.slice(0, 4);
          const overflow = allChildren.length - visible.length;

          return (
            <div
              key={i}
              className={[
                'cell',
                !c.inMonth ? 'muted' : '',
                c.weekend ? 'weekend' : '',
                isToday ? 'today' : '',
                conflict ? 'conflict' : '',
              ].filter(Boolean).join(' ')}
              onClick={(event) => {
                if (event.target.closest('.chip, .study, .more-pip')) return;
                onOpenDaySummary?.({ date: c.date, events: b.events, studies: b.studies });
              }}
            >
              <div className="daynum-wrap">
                <button
                  className="daynum"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenDaySummary?.({ date: c.date, events: b.events, studies: b.studies });
                  }}
                  aria-label={`Apri riepilogo del ${formatLongDate(c.date)}`}
                >
                  {c.date.getDate()}
                </button>
                {conflict && <span className="warn-pip" title="Più esami in questo giorno">⚠</span>}
              </div>
              <div className="chip-stack">
                {visible}
                {overflow > 0 && (
                  <button
                    className="more-pip"
                    onClick={() => onOpenDaySummary?.({ date: c.date, events: b.events, studies: b.studies })}
                  >
                    +{overflow} altri
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <Tooltip tt={tt} />
    </div>
  );
}
