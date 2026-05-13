import { useRef, useState } from 'react';
import { loadScore, statusLabel } from '../../utils/dates.js';

// ─── Dots ─────────────────────────────────────────────────────────────────────
export function Dots({ value, max = 10, variant }) {
  return (
    <div className="dots">
      {Array.from({ length: max }, (_, i) => (
        <span key={i} className={`dot ${i < value ? 'on' : ''} ${variant || ''}`} />
      ))}
    </div>
  );
}

// ─── LoadBadge ────────────────────────────────────────────────────────────────
export function LoadBadge({ effort, difficulty }) {
  const { level, label } = loadScore(effort, difficulty);
  return (
    <span className="load-badge">
      <span className={`pip ${level}`} />Carico: {label}
    </span>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
export function StatusBadge({ status }) {
  return <span className={`badge status-${status}`}>{statusLabel(status)}</span>;
}

// ─── CustomSlider ─────────────────────────────────────────────────────────────
export function CustomSlider({ value, onChange, variant = 'ticks', tone = 'ink' }) {
  const trackRef = useRef(null);
  const valRef = useRef(value);
  valRef.current = value;

  const fromClientX = (cx) => {
    const r = trackRef.current.getBoundingClientRect();
    const inner = r.width - 22;
    const x = Math.max(0, Math.min(inner, cx - r.left - 11));
    return Math.max(1, Math.min(10, Math.round((inner > 0 ? x / inner : 0) * 9) + 1));
  };

  const fromClientXBars = (cx) => {
    const r = trackRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, cx - r.left));
    return Math.max(1, Math.min(10, Math.ceil((x / r.width) * 10)));
  };

  const onDown = (e) => {
    e.preventDefault();
    const reader = variant === 'ticks' ? fromClientX : fromClientXBars;
    const v0 = reader(e.clientX);
    if (v0 !== valRef.current) onChange(v0);
    const move = (ev) => {
      const v = reader(ev.clientX);
      if (v !== valRef.current) onChange(v);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  if (variant === 'ticks') {
    const pct = ((value - 1) / 9) * 100;
    return (
      <div ref={trackRef} className="cust-slider" onPointerDown={onDown}>
        <div className="track" />
        <div className="fill" style={{ width: `calc(${pct}%)` }} />
        <div className="ticks">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`tk ${i === 0 || i === 9 || i === 4 ? 'major' : ''}`} />
          ))}
        </div>
        <div className="thumb" style={{ left: `calc(11px + (${pct} / 100) * (100% - 22px))` }}>
          {value}
        </div>
      </div>
    );
  }

  if (variant === 'bars') {
    return (
      <div ref={trackRef} className={`cust-slider bars ${tone === 'amber' ? 'amber' : ''}`} onPointerDown={onDown}>
        <div className="segs">
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className={`sg ${i < value ? 'on' : ''} ${i === value - 1 ? 'peak' : ''}`} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={trackRef} className="cust-slider column" onPointerDown={onDown}>
      <div className="cols">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`cl ${i < value ? 'on' : ''}`} />
        ))}
      </div>
    </div>
  );
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
export function useTooltip() {
  const [tt, setTT] = useState(null);
  return {
    tt,
    show: (e, content) => setTT({ x: e.clientX + 14, y: e.clientY + 14, content }),
    move: (e) => setTT((prev) => prev ? { ...prev, x: e.clientX + 14, y: e.clientY + 14 } : null),
    hide: () => setTT(null),
  };
}

export function Tooltip({ tt }) {
  if (!tt) return null;
  const w = 280;
  const left = (tt.x + w > window.innerWidth - 8) ? tt.x - w - 28 : tt.x;
  return (
    <div className="tooltip" style={{ left, top: tt.y }}>
      {tt.content}
    </div>
  );
}
