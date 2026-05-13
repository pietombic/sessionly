import { useMemo, useRef, useEffect } from 'react';
import { TAG_CSS } from '../data.js';
import { WEEKDAYS_IT, sameDay, startOfDay, formatLongDate, loadScore } from '../utils/dates.js';
import { useTooltip, Tooltip } from './ui/index.jsx';

const START_HOUR = 7;
const END_HOUR = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR; // 16
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

// Resolve study block slot from stored times (with sensible fallback)
function resolveSlot(st) {
  const s = parseTimeStr(st.startTime);
  const e = parseTimeStr(st.endTime);
  if (s !== null && e !== null) return { start: s, end: e };
  // Legacy fallback for blocks saved before time encoding
  const l = (st.label || '').toLowerCase();
  if (l.includes('mattina'))    return { start: 9,  end: 12 };
  if (l.includes('pomeriggio')) return { start: 14, end: 18 };
  if (l.includes('sera'))       return { start: 19, end: 22 };
  return { start: 9, end: 11 };
}

function isPicked(ev, datePicks) {
  if (datePicks.length === 0) return true;
  return datePicks.some(
    (p) => p.examId === ev.exam.id && p.componentName === ev.component && sameDay(p.date, ev.date.date)
  );
}

function buildWeekBuckets(cells, exams, studyWindows, datePicks, showAllDates) {
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

  for (const sw of studyWindows) {
    const exam = exams.find((e) => e.id === sw.examId);
    if (!exam) continue;
    for (const c of cells) {
      const d = startOfDay(c.date);
      if (d >= startOfDay(sw.start) && d <= startOfDay(sw.end)) {
        const key = c.date.toDateString();
        buckets.get(key).studies.push({
          id: sw.id,
          exam,
          label: sw.label,
          completed: sw.completed || false,
        });
      }
    }
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

export function WeekGrid({ weekStart, exams, studyWindows, datePicks = [], showAllDates = false, today, studyStyle, onSelectExam, onToggleStudyComplete }) {
  const scrollRef = useRef(null);

  const cells = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(weekStart.getTime() + i * 86400000);
      return { date: dt, weekend: dt.getDay() === 0 || dt.getDay() === 6 };
    }),
  [weekStart]);

  const buckets = useMemo(
    () => buildWeekBuckets(cells, exams, studyWindows, datePicks, showAllDates),
    [cells, exams, studyWindows, datePicks, showAllDates]
  );

  // Scroll to 8:00 on mount
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = timeToY(8) - 16;
    }
  }, []);

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
      <div className="ttline"><span className="l">Focus</span><span>{st.label}</span></div>
      <div className="ttline">
        <span className="l">Carico</span>
        <span>{loadScore(st.exam.effort, st.exam.difficulty).label}</span>
      </div>
      {st.completed && <div className="ttline"><span className="l">✓</span><span>Completato</span></div>}
    </>
  ));

  const nowHour = today.getHours() + today.getMinutes() / 60;

  return (
    <div className={`cal-wrap study-style-${studyStyle}`}>
      {/* Day headers */}
      <div className="cal-weekrow week-tg-header">
        <div className="week-tg-axis-gap" />
        {cells.map((c, i) => {
          const isToday = sameDay(c.date, today);
          return (
            <div key={i} className={`wd week-day-hd ${isToday ? 'week-day-hd-today' : ''}`}>
              <span>{WEEKDAYS_IT[i]}</span>
              <span className={`week-day-num ${isToday ? 'week-day-num-today' : ''}`}>
                {c.date.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable time grid */}
      <div className="week-tg-scroll scroll" ref={scrollRef}>
        <div className="week-tg" style={{ height: GRID_HEIGHT }}>

          {/* Time axis */}
          <div className="week-tg-axis">
            {Array.from({ length: TOTAL_HOURS }, (_, i) => (
              <div
                key={i}
                className="week-tg-hour-label"
                style={{ top: i * HOUR_PX }}
              >
                {String(START_HOUR + i).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {cells.map((c, ci) => {
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
                const { start, end } = resolveSlot(st);
                return { type: 'study', st, start, end };
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
                  <div className="week-tg-now" style={{ top: timeToY(nowHour) }} />
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
                        onClick={() => onSelectExam(ev.exam.id)}
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
                      onClick={() => onToggleStudyComplete?.(st.id)}
                      title={st.completed ? 'Completato · clicca per annullare' : 'Clicca per segnare come completato'}
                    >
                      <span className="tg-event-comp">
                        {st.completed ? '✓ Fatto' : 'Studio'}
                        {st.startTime && st.endTime && ` · ${st.startTime}–${st.endTime}`}
                      </span>
                      <span className="tg-event-name" style={{ textDecoration: st.completed ? 'line-through' : 'none' }}>
                        {st.exam.name}
                      </span>
                      <span className="tg-event-time">{st.label}</span>
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
