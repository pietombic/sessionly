import { useState, useEffect, useRef, useCallback } from 'react';

const WORK_PRESETS = [15, 25, 30, 45, 60];
const BREAK_PRESETS = [5, 10, 15, 20];

function pad(n) {
  return String(n).padStart(2, '0');
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}

const RADIUS = 28;
const CIRC = 2 * Math.PI * RADIUS;

export function PomodoroTimer() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('work'); // 'work' | 'break'
  const [workMins, setWorkMins] = useState(25);
  const [breakMins, setBreakMins] = useState(5);
  const [remaining, setRemaining] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef(null);

  const total = mode === 'work' ? workMins * 60 : breakMins * 60;
  const progress = 1 - remaining / total;

  const tick = useCallback(() => {
    setRemaining((r) => {
      if (r <= 1) {
        setRunning(false);
        setMode((m) => {
          if (m === 'work') {
            setSessions((s) => s + 1);
            setRemaining(breakMins * 60);
            return 'break';
          } else {
            setRemaining(workMins * 60);
            return 'work';
          }
        });
        return 0;
      }
      return r - 1;
    });
  }, [workMins, breakMins]);

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [running, tick]);

  const reset = () => {
    setRunning(false);
    setMode('work');
    setRemaining(workMins * 60);
  };

  const skip = () => {
    setRunning(false);
    if (mode === 'work') {
      setSessions((s) => s + 1);
      setMode('break');
      setRemaining(breakMins * 60);
    } else {
      setMode('work');
      setRemaining(workMins * 60);
    }
  };

  const changeWork = (mins) => {
    setWorkMins(mins);
    if (mode === 'work') { setRemaining(mins * 60); setRunning(false); }
  };

  const changeBreak = (mins) => {
    setBreakMins(mins);
    if (mode === 'break') { setRemaining(mins * 60); setRunning(false); }
  };

  const strokeDash = CIRC * progress;
  const isCurrent = mode === 'work';

  return (
    <div className="pomodoro-wrap">
      {open && (
        <div className={`pomodoro-panel ${mode === 'break' ? 'break-mode' : ''}`}>
          <div className="pomodoro-hd">
            <span className="pomodoro-title">
              {mode === 'work' ? '⏱ Studio' : '☕ Pausa'}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                className="pomodoro-icon-btn"
                onClick={() => setShowSettings((v) => !v)}
                title="Impostazioni"
              >⚙</button>
              <button
                className="pomodoro-icon-btn"
                onClick={() => setOpen(false)}
                title="Chiudi"
              >✕</button>
            </div>
          </div>

          {showSettings ? (
            <div className="pomodoro-settings">
              <div className="pom-setting-group">
                <span className="pom-setting-label">Studio</span>
                <div className="pom-presets">
                  {WORK_PRESETS.map((m) => (
                    <button
                      key={m}
                      className={`pom-preset ${workMins === m ? 'on' : ''}`}
                      onClick={() => changeWork(m)}
                    >{m}m</button>
                  ))}
                </div>
              </div>
              <div className="pom-setting-group">
                <span className="pom-setting-label">Pausa</span>
                <div className="pom-presets">
                  {BREAK_PRESETS.map((m) => (
                    <button
                      key={m}
                      className={`pom-preset ${breakMins === m ? 'on' : ''}`}
                      onClick={() => changeBreak(m)}
                    >{m}m</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="pomodoro-timer-wrap">
                <svg width="72" height="72" viewBox="0 0 72 72" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="36" cy="36" r={RADIUS} fill="none" stroke="var(--rule)" strokeWidth="4" />
                  <circle
                    cx="36" cy="36" r={RADIUS}
                    fill="none"
                    stroke={mode === 'work' ? 'var(--accent)' : '#6b8e6f'}
                    strokeWidth="4"
                    strokeDasharray={`${strokeDash} ${CIRC}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray .4s ease' }}
                  />
                </svg>
                <div className="pomodoro-time">{fmtTime(remaining)}</div>
              </div>

              <div className="pomodoro-controls">
                <button className="pom-ctrl-btn" onClick={reset} title="Reset">↩</button>
                <button
                  className={`pom-play-btn ${running ? 'pause' : 'play'}`}
                  onClick={() => setRunning((v) => !v)}
                >
                  {running ? '⏸' : '▶'}
                </button>
                <button className="pom-ctrl-btn" onClick={skip} title="Salta">⏭</button>
              </div>

              {sessions > 0 && (
                <div className="pom-sessions">
                  {Array.from({ length: Math.min(sessions, 8) }, (_, i) => (
                    <span key={i} className="pom-dot" />
                  ))}
                  {sessions > 8 && <span className="pom-sessions-count">+{sessions - 8}</span>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <button
        className={`pomodoro-fab ${running ? 'running' : ''} ${mode === 'break' ? 'break-fab' : ''}`}
        onClick={() => setOpen((v) => !v)}
        title="Timer Pomodoro"
      >
        {running ? fmtTime(remaining) : '⏱'}
      </button>
    </div>
  );
}
