import { useState, useRef, useCallback, useEffect } from 'react';
import { getGroqKey } from '../utils/groq.js';

const STYLE = `
  .twk-panel{position:fixed;right:16px;bottom:16px;z-index:2147483646;width:280px;
    max-height:calc(100vh - 32px);display:flex;flex-direction:column;
    background:color-mix(in srgb,var(--paper) 87%,transparent);
    color:var(--ink);
    -webkit-backdrop-filter:blur(24px) saturate(160%);backdrop-filter:blur(24px) saturate(160%);
    border:.5px solid color-mix(in srgb,var(--ink) 12%,transparent);border-radius:14px;
    box-shadow:0 1px 0 rgba(255,255,255,.5) inset,0 12px 40px rgba(0,0,0,.22);
    font:11.5px/1.4 ui-sans-serif,system-ui,-apple-system,sans-serif;overflow:hidden}
  .twk-hd{display:flex;align-items:center;justify-content:space-between;
    padding:10px 8px 10px 14px;cursor:move;user-select:none;
    border-bottom:.5px solid color-mix(in srgb,var(--ink) 8%,transparent)}
  .twk-hd b{font-size:12px;font-weight:600;letter-spacing:.01em}
  .twk-x{appearance:none;border:0;background:transparent;
    color:color-mix(in srgb,var(--ink) 55%,transparent);
    width:22px;height:22px;border-radius:6px;cursor:default;font-size:13px;line-height:1;
    display:grid;place-items:center}
  .twk-x:hover{background:color-mix(in srgb,var(--ink) 8%,transparent);color:var(--ink)}
  .twk-body{padding:8px 14px 14px;display:flex;flex-direction:column;gap:10px;
    overflow-y:auto;overflow-x:hidden;min-height:0;
    scrollbar-width:thin;scrollbar-color:color-mix(in srgb,var(--ink) 15%,transparent) transparent}
  .twk-sect{font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;
    color:color-mix(in srgb,var(--ink) 45%,transparent);padding:8px 0 0;margin:0}
  .twk-sect:first-child{padding-top:0}
  .twk-row{display:flex;flex-direction:column;gap:5px}
  .twk-row-h{flex-direction:row!important;align-items:center;justify-content:space-between;gap:10px}
  .twk-lbl{display:flex;justify-content:space-between;align-items:baseline;
    color:color-mix(in srgb,var(--ink) 72%,transparent)}
  .twk-lbl>span:first-child{font-weight:500}
  .twk-seg{position:relative;display:flex;padding:2px;border-radius:8px;
    background:color-mix(in srgb,var(--ink) 7%,transparent);user-select:none}
  .twk-seg-thumb{position:absolute;top:2px;bottom:2px;border-radius:6px;
    background:color-mix(in srgb,var(--paper) 95%,transparent);
    box-shadow:0 1px 2px rgba(0,0,0,.15);
    transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}
  .twk-seg button{appearance:none;position:relative;z-index:1;flex:1;border:0;
    background:transparent;color:inherit;font:inherit;font-weight:500;min-height:22px;
    border-radius:6px;cursor:default;padding:4px 6px;line-height:1.2}
  .twk-toggle{position:relative;width:32px;height:18px;border:0;border-radius:999px;
    background:color-mix(in srgb,var(--ink) 18%,transparent);
    transition:background .15s;cursor:default;padding:0;flex-shrink:0}
  .twk-toggle[data-on="1"]{background:#34c759}
  .twk-toggle i{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;
    background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.25);transition:transform .15s}
  .twk-toggle[data-on="1"] i{transform:translateX(14px)}
  .twk-chips{display:flex;gap:6px}
  .twk-chip{position:relative;appearance:none;flex:1;min-width:0;height:46px;
    padding:0;border:0;border-radius:6px;overflow:hidden;cursor:default;
    box-shadow:0 0 0 .5px rgba(0,0,0,.12),0 1px 2px rgba(0,0,0,.06);
    transition:transform .12s,box-shadow .12s}
  .twk-chip:hover{transform:translateY(-1px);box-shadow:0 0 0 .5px rgba(0,0,0,.18),0 4px 10px rgba(0,0,0,.12)}
  .twk-chip[data-on="1"]{box-shadow:0 0 0 1.5px color-mix(in srgb,var(--ink) 85%,transparent),0 2px 6px rgba(0,0,0,.15)}
  .twk-chip>span.swatches{position:absolute;top:0;bottom:0;right:0;width:34%;
    display:flex;flex-direction:column;box-shadow:-1px 0 0 rgba(0,0,0,.1)}
  .twk-chip>span.swatches>i{flex:1;box-shadow:0 -1px 0 rgba(0,0,0,.1)}
  .twk-chip>span.swatches>i:first-child{box-shadow:none}
  .twk-chip .chip-label{position:absolute;left:6px;bottom:4px;font-family:monospace;
    font-size:9px;letter-spacing:.05em;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.4);
    text-transform:uppercase}
  .twk-groq-btn{appearance:none;border:1px solid color-mix(in srgb,var(--ink) 18%,transparent);
    background:color-mix(in srgb,var(--paper) 60%,transparent);border-radius:5px;
    padding:5px 10px;font-size:11px;font-family:inherit;cursor:default;
    color:color-mix(in srgb,var(--ink) 80%,transparent);margin-top:4px}
  .twk-groq-btn:hover{background:color-mix(in srgb,var(--ink) 6%,transparent)}
  .twk-groq-dim{font-size:10px;color:color-mix(in srgb,var(--ink) 40%,transparent)}
  .twk-groq-ok{font-size:10px;color:#34c759}
`;

function TweakSection({ label }) {
  return <div className="twk-sect">{label}</div>;
}

function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl"><span>{label}</span></div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? '1' : '0'}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      ><i /></button>
    </div>
  );
}

function TweakRadio({ label, value, options, onChange }) {
  const trackRef = useRef(null);
  const valueRef = useRef(value);
  valueRef.current = value;
  const opts = options.map((o) => (typeof o === 'object' ? o : { value: o, label: o }));
  const idx = Math.max(0, opts.findIndex((o) => o.value === value));
  const n = opts.length;

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect();
    const i = Math.floor(((clientX - r.left - 2) / (r.width - 4)) * n);
    return opts[Math.max(0, Math.min(n - 1, i))].value;
  };

  const onPointerDown = (e) => {
    const v0 = segAt(e.clientX);
    if (v0 !== valueRef.current) onChange(v0);
    const move = (ev) => {
      const v = segAt(ev.clientX);
      if (v !== valueRef.current) onChange(v);
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return (
    <div className="twk-row">
      <div className="twk-lbl"><span>{label}</span></div>
      <div ref={trackRef} role="radiogroup" onPointerDown={onPointerDown} className="twk-seg">
        <div
          className="twk-seg-thumb"
          style={{ left: `calc(2px + ${idx} * (100% - 4px) / ${n})`, width: `calc((100% - 4px) / ${n})` }}
        />
        {opts.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={o.value === value}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaletteChips({ value, onChange }) {
  const opts = [
    { id: 'classic', name: 'Classico', colors: ['#1a2744', '#f5f0e8', '#c9a84c', '#9e3a2b'] },
    { id: 'warm',    name: 'Caldo',    colors: ['#2b1f1a', '#f7efe2', '#b8642a', '#8a2a1c'] },
    { id: 'cool',    name: 'Fresco',   colors: ['#142536', '#eef2ed', '#4f7d6e', '#8c3c3c'] },
  ];
  return (
    <div className="twk-chips">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          className="twk-chip"
          data-on={o.id === value ? '1' : '0'}
          title={o.name}
          style={{ background: o.colors[0], height: 46 }}
          onClick={() => onChange(o.id)}
        >
          <span className="swatches">
            {o.colors.slice(1).map((c, i) => <i key={i} style={{ background: c }} />)}
          </span>
          <span className="chip-label">{o.name}</span>
        </button>
      ))}
    </div>
  );
}

export function TweaksPanel({ tweaks, onTweak, onGroqKey }) {
  const [open, setOpen] = useState(false);
  const dragRef = useRef(null);
  const offsetRef = useRef({ x: 16, y: 16 });
  const PAD = 16;

  const clampToViewport = useCallback(() => {
    const panel = dragRef.current;
    if (!panel) return;
    const w = panel.offsetWidth, h = panel.offsetHeight;
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD);
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD);
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    };
    panel.style.right = offsetRef.current.x + 'px';
    panel.style.bottom = offsetRef.current.y + 'px';
  }, []);

  useEffect(() => {
    if (!open) return;
    clampToViewport();
    const ro = new ResizeObserver(clampToViewport);
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, [open, clampToViewport]);

  const onDragStart = (e) => {
    const panel = dragRef.current;
    if (!panel) return;
    const r = panel.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY;
    const startRight = window.innerWidth - r.right;
    const startBottom = window.innerHeight - r.bottom;
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      };
      clampToViewport();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <>
      {/* Gear button in the app — rendered outside the panel */}
      <button
        className="icon-btn twk-gear-btn"
        onClick={() => setOpen((v) => !v)}
        title="Impostazioni aspetto"
        aria-label="Apri pannello tweaks"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
          <path
            d="M8 1.5v1M8 13.5v1M1.5 8h-1M14.5 8h1M3.4 3.4l-.7-.7M13.3 13.3l-.7-.7M3.4 12.6l-.7.7M13.3 2.7l-.7.7"
            stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <>
          <style>{STYLE}</style>
          <div
            ref={dragRef}
            className="twk-panel"
            style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
          >
            <div className="twk-hd" onMouseDown={onDragStart}>
              <b>Aspetto</b>
              <button
                className="twk-x"
                aria-label="Chiudi"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => setOpen(false)}
              >✕</button>
            </div>
            <div className="twk-body">
              <TweakSection label="Palette" />
              <PaletteChips value={tweaks.palette} onChange={(v) => onTweak('palette', v)} />

              <TweakSection label="Font titoli" />
              <TweakRadio
                label=""
                value={tweaks.font}
                options={[
                  { value: 'unbounded', label: 'Unbounded' },
                  { value: 'lora',      label: 'Lora' },
                  { value: 'playfair',  label: 'Playfair' },
                  { value: 'freight',   label: 'Cormorant' },
                ]}
                onChange={(v) => onTweak('font', v)}
              />

              <TweakToggle label="Dark mode" value={tweaks.dark} onChange={(v) => onTweak('dark', v)} />

              <TweakSection label="Calendario" />
              <TweakRadio
                label="Blocchi studio"
                value={tweaks.studyStyle}
                options={[
                  { value: 'tratteggio', label: 'Tratt.' },
                  { value: 'band',       label: 'Banda' },
                  { value: 'dotted',     label: 'Punti' },
                  { value: 'underline',  label: 'Linea' },
                ]}
                onChange={(v) => onTweak('studyStyle', v)}
              />
              <TweakRadio
                label="Stile slider"
                value={tweaks.sliderStyle}
                options={[
                  { value: 'ticks',  label: 'Tacche' },
                  { value: 'bars',   label: 'Barre' },
                  { value: 'column', label: 'Colonne' },
                ]}
                onChange={(v) => onTweak('sliderStyle', v)}
              />
              <TweakSection label="AI" />
              <div className="twk-row">
                <div className="twk-lbl">
                  <span>Chiave Groq</span>
                  <span className={getGroqKey() ? 'twk-groq-ok' : 'twk-groq-dim'}>
                    {getGroqKey() ? '● Configurata' : '● Non configurata'}
                  </span>
                </div>
                <button type="button" className="twk-groq-btn" onClick={onGroqKey}>
                  {getGroqKey() ? 'Modifica chiave' : 'Aggiungi chiave'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
