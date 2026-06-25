import { useMemo, useRef, useEffect, useState } from 'react';
import { TAG_CSS } from '../data.js';
import { WEEKDAYS_IT, sameDay, formatLongDate, loadScore } from '../utils/dates.js';
import { useTooltip, Tooltip } from './ui/index.jsx';

const START_HOUR = 5;
const END_HOUR = 24; // represents midnight (00:00 of the next day)
const TOTAL_HOURS = END_HOUR - START_HOUR; // 19
const HOUR_PX = 52; // px per hour
const GRID_HEIGHT = TOTAL_HOURS * HOUR_PX;

function timeToY(hour) {
  return (hour - START_HOUR) * HOUR_PX;
}

// Parse "HH:MM" string → fractional hour
function parseTimeStr(str) {
  if (!str) return null;
  const m = str.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) + parseInt(m[2]) / 60;
}

function fmtHM(d) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function isPicked(ev, datePicks) {
  if (datePicks.length === 0) return true;
  return datePicks.some(
    (p) => p.examId === ev.exam.id && p.componentName === ev.component && sameDay(p.date, ev.date.date)
  );
}

function buildWeekBuckets(cells, exams, sessions, datePicks, showAllDates) {
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

  // Ogni sessione è una riga `events` indipendente, posizionata al suo orario reale.
  for (const s of sessions) {
    if (s.type !== 'study') continue;
    const exam = exams.find((e) => e.id === s.exam_id);
    if (!exam) continue;
    const start = new Date(s.start_time);
    const end   = new Date(s.end_time);
    const key   = start.toDateString();
    if (!buckets.has(key)) continue;
    buckets.get(key).studies.push({
      id: s.id,
      exam,
      label: s.notes || '',
      notes: s.notes || '',
      completed: s.status === 'completed',
      startHour: start.getHours() + start.getMinutes() / 60,
      endHour:   end.getHours() + end.getMinutes() / 60,
      startTime: fmtHM(start),
      endTime:   fmtHM(end),
      startISO:  start.toISOString(),
      endISO:    end.toISOString(),
    });
  }
  return buckets;
}

// Lay out a list of { start, end, ... } items without overlap using column assignment
function assignColumns(items) {
  const cols = [];
  return items.map((item) => {
    let col = 0;
    while (cols[col] !== undefined && cols[col] > item.start) col++;
    cols[col] = item.end;
    return { ...item, col, totalCols: null }; // totalCols computed after
  }).map((item, _, arr) => {
    // count how many items overlap this one
    const overlapping = arr.filter(
      (o) => o.col !== item.col && o.start < item.end && o.end > item.start
    );
    const totalCols = Math.max(item.col, ...overlapping.map((o) => o.col)) + 1;
    return { ...item, totalCols };
  });
}

export function WeekGrid({ weekStart, exams, events = [], datePicks = [], showAllDates = false, today, studyStyle, onSelectExam, onToggleStudyComplete, onRemoveStudyWindow, onOpenEventDetail, onMoveSession }) {
  const gridBodyRef = useRef(null);
  const dragRef = useRef(null);
  const suppressClickRef = useRef(false);
  const [dragPreview, setDragPreview] = useState({});

  // Current time state — updated every minute
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  // Mobile detection: show 3 days instead of 7 on narrow viewports
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  useEffect(() => {
    const handlePointerMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const rawDelta = ((event.clientY - drag.pointerY) / HOUR_PX) * 60;
      const deltaMinutes = Math.round(rawDelta / 15) * 15;
      let startMinutes = drag.startMinutes;
      let endMinutes = drag.endMinutes;

      if (drag.mode === 'move') {
        const duration = drag.endMinutes - drag.startMinutes;
        startMinutes = Math.max(START_HOUR * 60, Math.min(END_HOUR * 60 - duration, drag.startMinutes + deltaMinutes));
        endMinutes = startMinutes + duration;
      } else {
        endMinutes = Math.max(startMinutes + 15, Math.min(END_HOUR * 60, drag.endMinutes + deltaMinutes));
      }

      suppressClickRef.current = Math.abs(deltaMinutes) >= 15;
      setDragPreview((current) => ({
        ...current,
        [drag.id]: { startHour: startMinutes / 60, endHour: endMinutes / 60 },
      }));
    };

    const handlePointerUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      const preview = dragPreview[drag.id];
      dragRef.current = null;
      if (!preview || !suppressClickRef.current) {
        setDragPreview((current) => {
          const next = { ...current };
          delete next[drag.id];
          return next;
        });
        return;
      }

      const start = new Date(drag.startISO);
      const end = new Date(drag.endISO);
      const startMinutes = Math.round(preview.startHour * 60);
      const endMinutes = Math.round(preview.endHour * 60);
      start.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
      end.setHours(Math.floor(endMinutes / 60), endMinutes % 60, 0, 0);
      onMoveSession?.(drag.id, {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
      });
      setDragPreview((current) => {
        const next = { ...current };
        delete next[drag.id];
        return next;
      });
      window.setTimeout(() => { suppressClickRef.current = false; }, 0);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragPreview, onMoveSession]);

  const startDrag = (event, session, mode) => {
    if (isMobile || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const start = new Date(session.startISO);
    const end = new Date(session.endISO);
    dragRef.current = {
      id: session.id,
      mode,
      pointerY: event.clientY,
      startMinutes: start.getHours() * 60 + start.getMinutes(),
      endMinutes: end.getHours() * 60 + end.getMinutes(),
      startISO: session.startISO,
      endISO: session.endISO,
    };
    suppressClickRef.current = false;
    setDragPreview((current) => ({
      ...current,
      [session.id]: { startHour: session.startHour, endHour: session.endHour },
    }));
  };

  const cells = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(weekStart.getTime() + i * 86400000);
      return { date: dt, weekend: dt.getDay() === 0 || dt.getDay() === 6 };
    }),
  [weekStart]);

  // On mobile, show only 3 days centred on today (or on the first day of the week
  // if today is not in this week)
  const visibleCells = useMemo(() => {
    if (!isMobile) return cells;
    const todayIdx = cells.findIndex((c) => sameDay(c.date, today));
    const centerIdx = todayIdx !== -1 ? todayIdx : 0;
    const start = Math.max(0, Math.min(centerIdx - 1, cells.length - 3));
    return cells.slice(start, start + 3);
  }, [isMobile, cells, today]);

  const buckets = useMemo(
    () => buildWeekBuckets(cells, exams, events, datePicks, showAllDates),
    [cells, exams, events, datePicks, showAllDates]
  );

  // Auto-scroll to 7:00 on mount / week change
  useEffect(() => {
    if (!gridBodyRef.current) return;
    const targetHour = 7; // scroll to 7am
    const yOffset = (targetHour - START_HOUR) * HOUR_PX;
    gridBodyRef.current.scrollTo({ top: yOffset, behavior: 'instant' });
  }, [weekStart]);

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
      <h4>Studio · {st.exam.name}</h4>
      {st.startTime && st.endTime && (
        <div className="ttline"><span className="l">Orario</span><span>{st.startTime} – {st.endTime}</span></div>
      )}
      {st.label && <div className="ttline"><span className="l">Focus</span><span>{st.label}</span></div>}
      <div className="ttline">
        <span className="l">Carico</span>
        <span>{loadScore(st.exam.effort, st.exam.difficulty).label}</span>
      </div>
      {st.completed && <div className="ttline"><span className="l">✓</span><span>Completato</span></div>}
    </>
  ));

  // Current-time line position
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const startMinutes = START_HOUR * 60;
  const nowY = ((nowMinutes - startMinutes) / 60) * HOUR_PX;
  const nowHour = now.getHours() + now.getMinutes() / 60;

  return (
    <div className={`cal-wrap study-style-${studyStyle}`}>
      {/* Day headers — sticky so they stay visible during vertical scroll */}
      <div
        className="cal-weekrow week-tg-header"
        style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--paper)' }}
      >
        <div className="week-tg-axis-gap" />
        {visibleCells.map((c, i) => {
          const isToday = sameDay(c.date, today);
          // Map visible cell back to its original weekday index
          const origIdx = cells.indexOf(c);
          return (
            <div key={origIdx} className={`wd week-day-hd ${isToday ? 'week-day-hd-today' : ''}`}>
              <span>{WEEKDAYS_IT[origIdx]}</span>
              <span className={`week-day-num ${isToday ? 'week-day-num-today' : ''}`}>
                {c.date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid body */}
      <div
        className="week-tg-scroll scroll"
        ref={gridBodyRef}
      >
        <div className="week-tg" style={{ height: GRID_HEIGHT }}>

          {/* Time axis — sticky on horizontal scroll */}
          <div
            className="week-tg-axis"
            style={{ position: 'sticky', left: 0, zIndex: 9, background: 'var(--paper)' }}
          >
            {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
              const h = START_HOUR + i;
              if (h > END_HOUR) return null;
              return (
                <div
                  key={i}
                  className="week-tg-hour-label"
                  style={{ top: i * HOUR_PX }}
                >
                  {h === 24 ? '00:00' : String(h).padStart(2, '0') + ':00'}
                </div>
              );
            })}
          </div>

          {/* Day columns */}
          {visibleCells.map((c, ci) => {
            const key = c.date.toDateString();
            const b = buckets.get(key) || { events: [], studies: [] };
            const isToday = sameDay(c.date, today);
            const examsHere = new Set(b.events.map((e) => e.exam.id));
            const conflict = examsHere.size >= 2;

            // Build positioned items list for overlap layout
            const allItems = [
              ...b.events.map((ev) => {
                const h = parseTimeStr(ev.date.time);
                const start = h !== null ? h : 9;
                const end = start + 1.5;
                return { type: 'event', ev, start, end };
              }),
              ...b.studies.map((st) => {
                const preview = dragPreview[st.id];
                return {
                  type: 'study',
                  st,
                  start: preview?.startHour ?? st.startHour,
                  end: preview?.endHour ?? st.endHour,
                };
              }),
            ];

            const laid = assignColumns(allItems);

            return (
              <div
                key={ci}
                className={[
                  'week-tg-col',
                  c.weekend ? 'weekend' : '',
                  isToday ? 'today' : '',
                  conflict ? 'conflict' : '',
                ].filter(Boolean).join(' ')}
              >
                {/* Hour grid lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, h) => (
                  <div key={h} className="week-tg-hline" style={{ top: h * HOUR_PX }} />
                ))}
                {/* Half-hour lines */}
                {Array.from({ length: TOTAL_HOURS }, (_, h) => (
                  <div key={'h' + h} className="week-tg-hline half" style={{ top: h * HOUR_PX + HOUR_PX / 2 }} />
                ))}

                {/* Current time indicator */}
                {isToday && nowHour >= START_HOUR && nowHour <= END_HOUR && (
                  <div
                    className="week-now-line"
                    style={{ position: 'absolute', top: nowY, left: 0, right: 0, zIndex: 5, pointerEvents: 'none' }}
                  />
                )}

                {/* Conflict pip */}
                {conflict && <span className="warn-pip tg-warn" title="Più esami">⚠</span>}

                {/* Events */}
                {laid.map((item, idx) => {
                  const top = timeToY(item.start);
                  const height = Math.max((item.end - item.start) * HOUR_PX - 3, 22);
                  const colW = 100 / item.totalCols;
                  const left = item.col * colW;

                  if (item.type === 'event') {
                    const { ev } = item;
                    return (
                      <div
                        key={'e' + idx}
                        className={`week-tg-event chip ${ev.locked ? 'locked' : ''}`}
                        style={{
                          '--tag': TAG_CSS[ev.exam.tag],
                          top,
                          height,
                          left: `calc(${left}% + 2px)`,
                          width: `calc(${colW}% - 4px)`,
                        }}
                        onMouseEnter={(e) => showEvent(e, ev)}
                        onMouseMove={move}
                        onMouseLeave={hide}
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
                      >
                        {ev.locked && <span className="lock">🔒</span>}
                        <span className="tg-event-comp">{ev.component}</span>
                        <span className="tg-event-name">{ev.exam.name}</span>
                        {ev.date.time && (
                          <span className="tg-event-time">{ev.date.time}</span>
                        )}
                      </div>
                    );
                  }

                  const { st } = item;
                  return (
                    <div
                      key={'s' + idx}
                      className={`week-tg-event study ${st.completed ? 'study-done' : ''}`}
                      style={{
                        '--tag': TAG_CSS[st.exam.tag],
                        top,
                        height,
                        left: `calc(${left}% + 2px)`,
                        width: `calc(${colW}% - 4px)`,
                      }}
                      onMouseEnter={(e) => showStudy(e, st)}
                      onMouseMove={move}
                      onMouseLeave={hide}
                      onPointerDown={(event) => startDrag(event, st, 'move')}
                      onClick={() => {
                        if (suppressClickRef.current) return;
                        if (onOpenEventDetail) {
                          onOpenEventDetail({
                            type: 'session',
                            eventId: st.id,
                            examName: st.exam.name,
                            label: st.label || '',
                            notes: st.notes || '',
                            completed: st.completed,
                            startTime: st.startTime || null,
                            endTime: st.endTime || null,
                            startISO: st.startISO,
                            endISO: st.endISO,
                          });
                        } else {
                          onToggleStudyComplete?.(st.id);
                        }
                      }}
                      title={st.completed ? 'Completato · clicca per annullare' : 'Clicca per segnare come completato'}
                    >
                      <span className="tg-event-comp">
                        {st.completed ? '✓ Fatto' : 'Studio'}
                        {st.startTime && st.endTime && ` · ${st.startTime}–${st.endTime}`}
                      </span>
                      <span className="tg-event-name" style={{ textDecoration: st.completed ? 'line-through' : 'none' }}>
                        {st.exam.name}
                      </span>
                      {st.label && <span className="tg-event-time">{st.label}</span>}
                      <button
                        className="study-remove-btn"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(e) => { e.stopPropagation(); onRemoveStudyWindow?.(st.id); }}
                        title="Rimuovi sessione"
                        aria-label="Rimuovi sessione di studio"
                      >×</button>
                      {!isMobile && (
                        <span
                          className="session-resize-handle"
                          onPointerDown={(event) => startDrag(event, st, 'resize')}
                          title="Trascina per cambiare la durata"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <Tooltip tt={tt} />
    </div>
  );
}
