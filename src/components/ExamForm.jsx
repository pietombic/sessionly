import { useState } from 'react';
import { TAG_COLORS, TYPES } from '../data.js';
import { loadScore, statusLabel } from '../utils/dates.js';
import { CustomSlider, LoadBadge } from './ui/index.jsx';

function toInputDate(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function fromInputDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const blank = {
  name: '',
  code: '',
  tag: 'amber',
  type: 'scritto-orale',
  effort: 5,
  difficulty: 5,
  priority: 'media',
  status: 'todo',
  notes: '',
  partial1Done: false,
  partial1Grade: 18,
  components: [
    { name: 'Scritto', dates: [{ id: 'n1', date: null, time: '', room: '', locked: false }] },
    { name: 'Orale',   dates: [{ id: 'n2', date: null, time: '', room: '', locked: false }] },
  ],
};

function reviveDates(key, val) {
  if (key === 'date' && typeof val === 'string') return new Date(val);
  return val;
}

export function ExamForm({ initial, sliderStyle, onClose, onSave, onDelete }) {
  const isEditing = !!initial;

  const [draft, setDraft] = useState(() => {
    if (!initial) return blank;
    return JSON.parse(JSON.stringify(initial), reviveDates);
  });

  const onTypeChange = (typeId) => {
    const typeDef = TYPES.find((t) => t.id === typeId);
    if (!typeDef) return;
    setDraft((prev) => {
      const byName = new Map(prev.components.map((c) => [c.name, c]));
      const newComps = typeDef.components.map((cname) =>
        byName.get(cname) || {
          name: cname,
          dates: [{ id: 'n_' + cname + Date.now(), date: null, time: '', room: '', locked: false }],
        }
      );
      return { ...prev, type: typeId, components: newComps };
    });
  };

  const hasParziali = draft.type.startsWith('parziali');

  const setComp = (idx, fn) =>
    setDraft((prev) => ({
      ...prev,
      components: prev.components.map((c, i) => (i === idx ? fn(c) : c)),
    }));

  const addDate = (ci) =>
    setComp(ci, (c) => ({
      ...c,
      dates: [...c.dates, { id: 'n_' + Date.now(), date: null, time: '', room: '', locked: false }],
    }));

  const removeDate = (ci, dateId) =>
    setComp(ci, (c) => ({ ...c, dates: c.dates.filter((d) => d.id !== dateId) }));

  const updateDate = (ci, dateId, patch) =>
    setComp(ci, (c) => ({
      ...c,
      dates: c.dates.map((d) => (d.id === dateId ? { ...d, ...patch } : d)),
    }));

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-hd">
          <div>
            <h2>{isEditing ? draft.name || 'Modifica esame' : 'Nuovo esame'}</h2>
            <div className="sub">
              {isEditing
                ? 'Aggiorna dettagli, date e blocchi di studio.'
                : "Inserisci l'esame con tutte le sue componenti."}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body scroll">

          {/* ── basics ─────────────────────────────── */}
          <div className="col" style={{ gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <div className="field">
                <label className="field-label">Nome esame</label>
                <input
                  className="input"
                  value={draft.name}
                  placeholder="es. Analisi Matematica II"
                  onChange={(e) => set({ name: e.target.value })}
                />
              </div>
              <div className="field">
                <label className="field-label">Codice</label>
                <input
                  className="input mono"
                  value={draft.code}
                  placeholder="MAT-202"
                  onChange={(e) => set({ code: e.target.value })}
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Colore etichetta</label>
              <div className="swatch-row">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c.name}
                    className={`swatch ${draft.tag === c.name ? 'on' : ''}`}
                    style={{ background: c.hex }}
                    onClick={() => set({ tag: c.name })}
                    aria-label={c.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── exam type ──────────────────────────── */}
          <div className="field">
            <label className="field-label">Tipologia esame</label>
            <div className="type-grid">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  className={`type-card ${draft.type === t.id ? 'on' : ''}`}
                  onClick={() => onTypeChange(t.id)}
                >
                  <span className="ttype-icon">{t.short}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── sliders ──────────────────────────── */}
          <div className="field">
            <label className="field-label">Effort &amp; Difficoltà</label>
            <div className="slider-row">
              <div className="slider-block">
                <div className="slider-head">
                  <span className="name">Effort</span>
                  <span className="val">{draft.effort}<span className="of">/10</span></span>
                </div>
                <CustomSlider
                  value={draft.effort}
                  onChange={(v) => set({ effort: v })}
                  variant={sliderStyle}
                  tone="amber"
                />
                <div className="scale"><span>Poche ore</span><span>Mesi</span></div>
              </div>
              <div className="slider-block">
                <div className="slider-head">
                  <span className="name">Difficoltà</span>
                  <span className="val">{draft.difficulty}<span className="of">/10</span></span>
                </div>
                <CustomSlider
                  value={draft.difficulty}
                  onChange={(v) => set({ difficulty: v })}
                  variant={sliderStyle}
                />
                <div className="scale"><span>Accessibile</span><span>Ostico</span></div>
              </div>
            </div>
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <LoadBadge effort={draft.effort} difficulty={draft.difficulty} />
            </div>
          </div>

          {/* ── parziali ─────────────────────────── */}
          {hasParziali && (
            <div className="field" style={{
              padding: 14, background: 'var(--paper-2)',
              border: '1px solid var(--rule)', borderRadius: 4,
            }}>
              <label className="field-label">Stato parziali</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6 }}>
                <button
                  className={`toggle-lock ${draft.partial1Done ? 'on' : ''}`}
                  onClick={() => set({ partial1Done: !draft.partial1Done })}
                >
                  {draft.partial1Done ? '✓' : '○'} Parziale 1 sostenuto
                </button>
                {draft.partial1Done && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>Voto:</span>
                    <input
                      type="number"
                      className="input mono"
                      style={{ width: 70, padding: '6px 10px' }}
                      min={0} max={31}
                      value={draft.partial1Grade}
                      onChange={(e) => set({ partial1Grade: Number(e.target.value) })}
                    />
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--ink-soft)' }}>/30</span>
                    <span
                      className={`badge ${draft.partial1Grade >= 18 ? 'status-done' : ''}`}
                      style={draft.partial1Grade < 18 ? { color: 'var(--warn)', borderColor: 'var(--warn)' } : {}}
                    >
                      {draft.partial1Grade >= 18 ? 'Superato' : 'Non superato'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── components & dates ────────────────── */}
          {draft.components.map((comp, ci) => (
            <div key={comp.name} className="date-component">
              <div className="comp-hd">
                <h4>{comp.name}</h4>
                <button className="btn-text" onClick={() => addDate(ci)}>+ Data</button>
              </div>
              <div className="date-rows">
                {comp.dates.map((dt) => (
                  <div key={dt.id} className={`date-row ${dt.locked ? 'locked' : ''}`}>
                    <input
                      type="date"
                      className="input mono"
                      style={{ padding: '7px 10px' }}
                      value={toInputDate(dt.date)}
                      onChange={(e) => updateDate(ci, dt.id, { date: fromInputDate(e.target.value) })}
                    />
                    <input
                      type="time"
                      className="input mono"
                      style={{ padding: '7px 10px' }}
                      value={dt.time}
                      onChange={(e) => updateDate(ci, dt.id, { time: e.target.value })}
                    />
                    <input
                      className="input"
                      style={{ padding: '7px 10px' }}
                      placeholder="Sede / aula"
                      value={dt.room}
                      onChange={(e) => updateDate(ci, dt.id, { room: e.target.value })}
                    />
                    <button
                      className={`toggle-lock ${dt.locked ? 'on' : ''}`}
                      onClick={() => updateDate(ci, dt.id, { locked: !dt.locked })}
                      title="Data bloccata: non spostabile"
                    >
                      {dt.locked ? '🔒' : '○'} {dt.locked ? 'Bloccata' : 'Mobile'}
                    </button>
                    <button
                      className="icon-x"
                      onClick={() => removeDate(ci, dt.id)}
                      aria-label="Rimuovi data"
                      disabled={comp.dates.length <= 1}
                      style={comp.dates.length <= 1 ? { opacity: 0.35, cursor: 'not-allowed' } : {}}
                    >×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* ── priority & status ───────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="field-label">Priorità</label>
              <div className="pills">
                {['alta', 'media', 'bassa'].map((p) => (
                  <button
                    key={p}
                    className={`pill ${draft.priority === p ? 'on' : ''}`}
                    data-prio={p}
                    onClick={() => set({ priority: p })}
                  >
                    <span className="pillpip" />{p[0].toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label className="field-label">Stato</label>
              <div className="pills">
                {['todo', 'active', 'partial', 'done'].map((s) => (
                  <button
                    key={s}
                    className={`pill ${draft.status === s ? 'on' : ''}`}
                    onClick={() => set({ status: s })}
                  >
                    {statusLabel(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ── notes ──────────────────────────── */}
          <div className="field">
            <label className="field-label">Note</label>
            <textarea
              className="input"
              placeholder="Cose da ricordare, argomenti critici, materiale di riferimento…"
              value={draft.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </div>

        <div className="modal-ft">
          <div>
            {isEditing && (
              <button className="btn danger" onClick={() => onDelete(initial.id)}>
                Elimina esame
              </button>
            )}
          </div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={onClose}>Annulla</button>
            <button className="btn" onClick={() => onSave(draft)}>
              {isEditing ? 'Salva modifiche' : 'Aggiungi esame'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
