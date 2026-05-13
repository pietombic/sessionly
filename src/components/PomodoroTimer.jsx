import { useState, useEffect, useRef, useCallback } from 'react';

const WORK_PRESETS  = [15, 25, 30, 45, 60];
const BREAK_PRESETS = [5, 10, 15, 20];
const RADIUS = 90;
const CIRC   = 2 * Math.PI * RADIUS;

function pad(n) { return String(n).padStart(2, '0'); }
function fmtTime(secs) { return `${pad(Math.floor(secs / 60))}:${pad(secs % 60)}`; }

export function usePomodoroTimer() {
  const [mode,     setMode]     = useState('work');
  const [workMins, setWorkMins] = useState(25);
  const [breakMins,setBreakMins]= useState(5);
  const [remaining,setRemaining]= useState(25 * 60);
  const [running,  setRunning]  = useState(false);
  const [sessions, setSessions] = useState(0);

  const intervalRef = useRef(null);

  const tick = useCallback(() => {
    setRemaining((r) => {
      if (r <= 1) {
        setRunning(false);
        setMode((m) => {
          if (m === 'work') {
            setSessions((s) => s + 1);
            setRemaining(breakMins * 60);
            return 'break';
          }
          setRemaining(workMins * 60);
          return 'work';
        });
        return 0;
      }
      return r - 1;
    });
  }, [workMins, breakMins]);

  useEffect(() => {
    if (running) { intervalRef.current = setInterval(tick, 1000); }
    else { clearInterval(intervalRef.current); }
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  const reset = () => { setRunning(false); setMode('work'); setRemaining(workMins * 60); };

  const skip = () => {
    setRunning(false);
    if (mode === 'work') { setSessions((s) => s + 1); setMode('break'); setRemaining(breakMins * 60); }
    else { setMode('work'); setRemaining(workMins * 60); }
  };

  const changeWork = (m) => { setWorkMins(m); if (mode === 'work')  { setRemaining(m * 60); setRunning(false); } };
  const changeBreak= (m) => { setBreakMins(m);if (mode === 'break') { setRemaining(m * 60); setRunning(false); } };

  const total    = mode === 'work' ? workMins * 60 : breakMins * 60;
  const progress = 1 - remaining / total;

  return { mode, workMins, breakMins, remaining, running, sessions, progress,
           setRunning, reset, skip, changeWork, changeBreak };
}

/* ─── FAB (shown only outside the Pomodoro view) ─────────────────────────── */
export function PomodoroFab({ pom, onOpen }) {
  const { mode, running, remaining } = pom;
  return (
    <div className="pomodoro-wrap">
      <button
        className={`pomodoro-fab ${running ? 'running' : ''} ${mode === 'break' ? 'break-fab' : ''}`}
        onClick={onOpen}
        title="Timer Pomodoro"
      >
        {running ? fmtTime(remaining) : '⏱'}
      </button>
    </div>
  );
}

/* ─── Full-screen Pomodoro view ───────────────────────────────────────────── */
export function PomodoroView({ pom, onClose }) {
  const [showSettings, setShowSettings] = useState(false);
  const { mode, workMins, breakMins, remaining, running, sessions, progress,
          setRunning, reset, skip, changeWork, changeBreak } = pom;

  const strokeDash = CIRC * progress;
  const isWork = mode === 'work';

  return (
    <div className={`pom-view ${!isWork ? 'pom-break' : ''}`}>

      <span className="pom-view-mode-label">
        {isWork ? '⏱ Studio' : '☕ Pausa'}
      </span>

      {/* ring + time */}
      <div className="pom-view-ring-wrap">
        <svg className="pom-view-svg" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r={RADIUS} fill="none" stroke="var(--rule)" strokeWidth="6"/>
          <circle
            cx="110" cy="110" r={RADIUS}
            fill="none"
            stroke={isWork ? 'var(--accent)' : '#6b8e6f'}
            strokeWidth="6"
            strokeDasharray={`${strokeDash} ${CIRC}`}
            strokeLinecap="round"
            transform="rotate(-90 110 110)"
            style={{ transition: 'stroke-dasharray .6s ease' }}
          />
        </svg>
        <div className="pom-view-time">{fmtTime(remaining)}</div>
      </div>

      {/* controls */}
      <div className="pom-view-controls">
        <button className="pom-view-ctrl" onClick={reset} title="Reset">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/>
            <path d="M3.51 15a9 9 0 1 0 .49-3.5"/>
          </svg>
        </button>
        <button
          className={`pom-view-play ${running ? 'pause' : ''}`}
          onClick={() => setRunning((v) => !v)}
          aria-label={running ? 'Pausa' : 'Avvia'}
        >
          {running
            ? <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
            : <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>
          }
        </button>
        <button className="pom-view-ctrl" onClick={skip} title="Salta">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 4 15 12 5 20" fill="currentColor" stroke="none"/>
            <line x1="19" y1="5" x2="19" y2="19"/>
          </svg>
        </button>
      </div>

      {/* session dots */}
      {sessions > 0 && (
        <div className="pom-view-sessions">
          {Array.from({ length: Math.min(sessions, 8) }, (_, i) => (
            <span key={i} className="pom-dot-lg" />
          ))}
          {sessions > 8 && <span className="pom-sessions-count">+{sessions - 8}</span>}
        </div>
      )}

      {/* settings panel (inline, below controls) */}
      {showSettings && (
        <div className="pom-view-settings">
          <div className="pom-setting-group">
            <span className="pom-setting-label">Studio</span>
            <div className="pom-presets">
              {WORK_PRESETS.map((m) => (
                <button key={m} className={`pom-preset ${workMins === m ? 'on' : ''}`} onClick={() => changeWork(m)}>{m}m</button>
              ))}
            </div>
          </div>
          <div className="pom-setting-group">
            <span className="pom-setting-label">Pausa</span>
            <div className="pom-presets">
              {BREAK_PRESETS.map((m) => (
                <button key={m} className={`pom-preset ${breakMins === m ? 'on' : ''}`} onClick={() => changeBreak(m)}>{m}m</button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* text actions */}
      <div className="pom-view-actions">
        <button className="pom-view-action-btn" onClick={() => setShowSettings((v) => !v)}>
          {showSettings ? 'Nascondi impostazioni' : 'Impostazioni'}
        </button>
        <span className="pom-view-action-sep">·</span>
        <button className="pom-view-action-btn" onClick={onClose}>Chiudi</button>
      </div>

    </div>
  );
}
