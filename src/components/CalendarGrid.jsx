import { useMemo } from 'react';
import { TAG_CSS } from '../data.js';
import { WEEKDAYS_IT, monthGrid, sameDay, startOfDay, formatLongDate, loadScore } from '../utils/dates.js';
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
    >
      {ev.locked && <span className="lock">🔒</span>}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        <span className="ctype" style={{ marginRight: 4 }}>{ev.component}</span>
        {ev.exam.name.split(' ').slice(0, 2).join(' ')}
      </span>
    </div>
  );
}

function StudyBlock({ st, onHover, onMove, onLeave }) {
  return (
    <div
      className="study"
      style={{ '--tag': TAG_CSS[st.exam.tag] }}
      onMouseEnter={(e) => onHover(e, st)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <span className="stype">Studia</span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {st.exam.name.split(' ')[0]}
      </span>
    </div>
  );
}

function buildBuckets(cells, exams, studyWindows) {
  const buckets = new Map();
  for (const c of cells) buckets.set(c.date.toDateString(), { events: [], studies: [] });

  for (const exam of exams) {
    for (const comp of exam.components) {
      for (const dt of comp.dates) {
        if (!dt.date) continue;
        const key = dt.date.toDateString();
        if (buckets.has(key)) {
          buckets.get(key).events.push({ exam, component: comp.name, date: dt, locked: dt.locked });
        }
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
          exam,
          label: sw.label,
          isStart: sameDay(c.date, sw.start),
          isEnd: sameDay(c.date, sw.end),
        });
      }
    }
  }

  return buckets;
}

export function CalendarGrid({ year, month, exams, studyWindows, today, studyStyle, onSelectExam }) {
  const allCells = useMemo(() => monthGrid(year, month), [year, month]);
  const buckets = useMemo(() => buildBuckets(allCells, exams, studyWindows), [allCells, exams, studyWindows]);
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
      <div className="ttline"><span className="l">Suggerito</span><span>{st.label}</span></div>
      <div className="ttline">
        <span className="l">Carico</span>
        <span>{loadScore(st.exam.effort, st.exam.difficulty).label}</span>
      </div>
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

          const seen = new Set();
          const studies = b.studies.filter((s) => {
            if (seen.has(s.exam.id)) return false;
            seen.add(s.exam.id);
            return true;
          });

          const allChildren = [
            ...b.events.map((ev, idx) => (
              <EventChip
                key={'e' + idx}
                ev={ev}
                onHover={showEvent}
                onMove={move}
                onLeave={hide}
                onClick={() => onSelectExam(ev.exam.id)}
              />
            )),
            ...studies.map((st, idx) => (
              <StudyBlock key={'s' + idx} st={st} onHover={showStudy} onMove={move} onLeave={hide} />
            )),
          ];

          const visible = allChildren.slice(0, 3);
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
            >
              <div className="daynum-wrap">
                <span className="daynum">{c.date.getDate()}</span>
                {conflict && <span className="warn-pip" title="Più esami in questo giorno">⚠</span>}
              </div>
              <div className="chip-stack">
                {visible}
                {overflow > 0 && <span className="more-pip">+{overflow} altri</span>}
              </div>
            </div>
          );
        })}
      </div>
      <Tooltip tt={tt} />
    </div>
  );
}
