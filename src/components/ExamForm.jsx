import { useState, useRef } from 'react';
import { TAG_COLORS, TYPES } from '../data.js';
import { loadScore, statusLabel, startOfDay } from '../utils/dates.js';
import { CustomSlider, LoadBadge } from './ui/index.jsx';
import { extractExamFromDescription } from '../utils/groq.js';

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
  cfu: '',
  openBook: false,
  priority: 'media',
  status: 'todo',
  grade: null,
  gradeLode: false,
  notes: '',
  partial1Done: false,
  partial1Grade: 18,
  examApproach: null,
  pages: '',
  pdfCount: '',
  topics: '',
  materialDesc: '',
  components: [
    { name: 'Scritto', dates: [{ id: 'n1', date: null, time: '', room: '', locked: false }] },
    { name: 'Orale',   dates: [{ id: 'n2', date: null, time: '', room: '', locked: false }] },
  ],
};

function reviveDates(key, val) {
  if (key === 'date' && typeof val === 'string') return new Date(val);
  return val;
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function ExamForm({ initial, sliderStyle, today, onClose, onSave, onDelete, onNoGroqKey }) {
  const isEditing = !!initial;

  const [draft, setDraft] = useState(() => {
    if (!initial) return blank;
    return JSON.parse(JSON.stringify(initial), reviveDates);
  });

  // ── voice / AI section ──────────────────────────────────────────────────
  const [showProgramDetails, setShowProgramDetails] = useState(
    !!(initial?.topics || initial?.pages || initial?.examApproach || initial?.materialDesc)
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef(null);

  const toggleRecording = () => {
    if (recording) {
      recognitionRef.current?.stop();
      return;
    }
    const recog = new SR();
    recog.lang = 'it-IT';
    recog.continuous = true;
    recog.interimResults = false;
    recog.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join(' ');
      setVoiceText((prev) => prev ? prev + ' ' + transcript : transcript);
    };
    recog.onend = () => setRecording(false);
    recog.onerror = () => setRecording(false);
    recog.start();
    recognitionRef.current = recog;
    setRecording(true);
  };

  const handleExtract = async () => {
    if (!voiceText.trim()) return;
    setVoiceLoading(true);
    setVoiceError('');
    try {
      const extracted = await extractExamFromDescription(voiceText);

      const newComponents = extracted.components?.length > 0
        ? extracted.components.map((c, i) => ({
            name: c.name,
            dates: c.dates.map((d, j) => ({
              id: `ext_${i}_${j}_${Date.now()}`,
              date: d.date,
              time: d.time,
              room: d.room,
              locked: d.locked,
            })),
          }))
        : null;

      let newType = draft.type;
      if (newComponents) {
        const names = new Set(newComponents.map((c) => c.name));
        const matched = TYPES.find(
          (t) => t.components.length === names.size && t.components.every((n) => names.has(n))
        );
        if (matched) newType = matched.id;
      }

      setDraft((prev) => ({
        ...prev,
        ...(extracted.name ? { name: extracted.name } : {}),
        ...(extracted.tag ? { tag: extracted.tag } : {}),
        ...(extracted.effort != null ? { effort: extracted.effort } : {}),
        ...(extracted.difficulty != null ? { difficulty: extracted.difficulty } : {}),
        ...(extracted.examApproach ? { examApproach: extracted.examApproach } : {}),
        ...(extracted.pages ? { pages: String(extracted.pages) } : {}),
        ...(extracted.pdfCount ? { pdfCount: String(extracted.pdfCount) } : {}),
        ...(extracted.topics?.length ? { topics: extracted.topics.join('\n') } : {}),
        ...(newComponents ? { components: newComponents, type: newType } : {}),
      }));
      if (extracted.examApproach || extracted.pages || extracted.topics?.length) {
        setShowProgramDetails(true);
      }
      setShowVoice(false);
      setVoiceText('');
    } catch (err) {
      if (err.code === 'NO_KEY') {
        onNoGroqKey?.();
        setShowVoice(false);
      } else {
        setVoiceError(err.message || 'Errore durante l\'estrazione.');
      }
    } finally {
      setVoiceLoading(false);
    }
  };

  // ── exam result (post-date) ─────────────────────────────────────────────
  const earliestDate = draft.components
    .flatMap((c) => c.dates.map((d) => d.date))
    .filter(Boolean)
    .sort((a, b) => a - b)[0];

  const examHasPassed = isEditing && today && earliestDate
    && startOfDay(earliestDate) <= startOfDay(today);

  // ── form helpers ────────────────────────────────────────────────────────
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
      <div className="modal modal--form" onClick={(e) => e.stopPropagation()}>
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

          {/* ── AI voice section ──────────────────── */}
          {showVoice ? (
            <div className="voice-section">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="field-label" style={{ margin: 0 }}>Descrivi l'esame</span>
                <button className="modal-close" style={{ width: 22, height: 22, fontSize: 12 }} onClick={() => { setShowVoice(false); setVoiceError(''); }}>✕</button>
              </div>
              <textarea
                className="input"
                style={{ minHeight: 86, fontSize: 13, lineHeight: 1.5 }}
                placeholder={'es. "Ho un esame di Analisi II il 24 giugno. C\'è tanto da studiare, è difficile. C\'è anche un orale il 7 luglio."'}
                value={voiceText}
                onChange={(e) => { setVoiceText(e.target.value); setVoiceError(''); }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {SR && (
                  <button
                    type="button"
                    className={`mic-btn ${recording ? 'recording' : ''}`}
                    onClick={toggleRecording}
                    title={recording ? 'Ferma registrazione' : 'Registra con microfono'}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="2" width="6" height="12" rx="3"/>
                      <path d="M5 10a7 7 0 0014 0M12 19v3M8 22h8"/>
                    </svg>
                    {recording ? 'Ferma' : 'Registra'}
                  </button>
                )}
                {voiceError && (
                  <span style={{ fontSize: 11.5, color: 'var(--warn)', flex: 1 }}>⚠ {voiceError}</span>
                )}
                <button
                  className={`ai-btn ${voiceLoading ? 'loading' : ''}`}
                  style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }}
                  disabled={!voiceText.trim() || voiceLoading}
                  onClick={handleExtract}
                >
                  <span>{voiceLoading ? '⟳' : '✦'}</span>
                  {voiceLoading ? 'Estrazione...' : 'Estrai informazioni'}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="ai-btn"
              style={{ alignSelf: 'flex-start', fontSize: 12, padding: '7px 12px' }}
              onClick={() => setShowVoice(true)}
            >
              <span>✦</span> Descrivi con AI
            </button>
          )}

          {/* ── basics ─────────────────────────────── */}
          <div className="col" style={{ gap: 12 }}>
            <div className="name-code-grid">
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

          {/* ── CFU & Open Book ─────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label className="field-label">CFU</label>
              <input
                type="number"
                className="input mono"
                min={1}
                max={30}
                placeholder="es. 9"
                value={draft.cfu}
                onChange={(e) => set({ cfu: e.target.value })}
              />
              <div className="field-hint">1 CFU ≈ 25 ore di studio</div>
            </div>
            <div className="field">
              <label className="field-label">Open Book</label>
              <div className="pills">
                <button
                  type="button"
                  className={`pill ${draft.openBook ? 'on' : ''}`}
                  onClick={() => set({ openBook: true })}
                >
                  Consentito
                </button>
                <button
                  type="button"
                  className={`pill ${!draft.openBook ? 'on' : ''}`}
                  onClick={() => set({ openBook: false })}
                >
                  Chiuso
                </button>
              </div>
              <div className="field-hint">Puoi portare appunti cartacei all'esame</div>
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

          {/* ── program details (collapsible) ─── */}
          <div className="program-details-section">
            <button
              type="button"
              className="program-details-toggle"
              onClick={() => setShowProgramDetails((v) => !v)}
            >
              <span>{showProgramDetails ? '▾' : '▸'}</span>
              Dettagli programma
              {(draft.examApproach || draft.pages || draft.topics || draft.materialDesc) && (
                <span className="program-details-dot" />
              )}
            </button>

            {showProgramDetails && (
              <div className="program-details-body">
                <div className="field">
                  <label className="field-label">Tipo di studio</label>
                  <div className="pills">
                    {[
                      { id: 'teorico', label: 'Teorico', hint: 'Ripasso e memorizzazione' },
                      { id: 'misto',   label: 'Misto',   hint: 'Teoria + esercizi' },
                      { id: 'pratico', label: 'Pratico', hint: 'Esercizi e prove simulate' },
                    ].map((a) => (
                      <button
                        key={a.id}
                        className={`pill ${draft.examApproach === a.id ? 'on' : ''}`}
                        title={a.hint}
                        onClick={() => set({ examApproach: draft.examApproach === a.id ? null : a.id })}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <div className="field-hint">
                    {draft.examApproach === 'pratico' && "L'AI riserverà tempo per esercizi e prove d'esame."}
                    {draft.examApproach === 'teorico' && "L'AI riserverà tempo per ripasso e consolidamento."}
                    {draft.examApproach === 'misto' && "L'AI bilancerà teoria ed esercizi."}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="field">
                    <label className="field-label">Pagine totali</label>
                    <input
                      type="number"
                      className="input mono"
                      min={0}
                      placeholder="es. 320"
                      value={draft.pages}
                      onChange={(e) => set({ pages: e.target.value })}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label">N° PDF / file</label>
                    <input
                      type="number"
                      className="input mono"
                      min={0}
                      placeholder="es. 8"
                      value={draft.pdfCount}
                      onChange={(e) => set({ pdfCount: e.target.value })}
                    />
                  </div>
                </div>

                <div className="field">
                  <label className="field-label">Argomenti del programma</label>
                  <textarea
                    className="input"
                    style={{ minHeight: 90 }}
                    placeholder={'Un argomento per riga:\nAlgebra lineare\nSerie di Fourier\nEquazioni differenziali'}
                    value={draft.topics}
                    onChange={(e) => set({ topics: e.target.value })}
                  />
                  <div className="field-hint">L'AI dividerà questi argomenti nelle sessioni di studio.</div>
                </div>

                <div className="field">
                  <label className="field-label">Materiale di studio</label>
                  <textarea
                    className="input"
                    style={{ minHeight: 72 }}
                    placeholder={'es. Libro di testo (Cormen), 8 slide del prof, raccolta esercizi anni passati…'}
                    value={draft.materialDesc}
                    onChange={(e) => set({ materialDesc: e.target.value })}
                  />
                  <div className="field-hint">Descrivi cosa hai a disposizione: libri, slide, esercizi, video…</div>
                </div>
              </div>
            )}
          </div>

          {/* ── exam outcome (shown only when date has passed) ── */}
          {examHasPassed && (
            <div className="outcome-section">
              <div className="field-label" style={{ marginBottom: 10 }}>Com'è andata?</div>
              <div className="outcome-btns">
                <button
                  className={`outcome-btn outcome-passed ${draft.status === 'done' ? 'on' : ''}`}
                  onClick={() => set({ status: 'done' })}
                >
                  <span>✓</span> Superato
                </button>
                <button
                  className={`outcome-btn outcome-failed ${draft.status === 'failed' ? 'on' : ''}`}
                  onClick={() => set({ status: 'failed' })}
                >
                  <span>✗</span> Non superato
                </button>
                <button
                  className={`outcome-btn outcome-skipped ${draft.status === 'saltato' ? 'on' : ''}`}
                  onClick={() => set({ status: 'saltato' })}
                >
                  <span>○</span> Saltato
                </button>
              </div>

              {draft.status === 'done' && (
                <div className="grade-row">
                  <span className="grade-label">Voto</span>
                  <input
                    type="number"
                    className="grade-input"
                    min={18}
                    max={30}
                    disabled={draft.gradeLode}
                    value={draft.gradeLode ? 30 : (draft.grade ?? '')}
                    onChange={(e) => set({ grade: e.target.value ? Math.min(30, Math.max(18, Number(e.target.value))) : null })}
                    placeholder="18–30"
                  />
                  <label className="grade-lode">
                    <input
                      type="checkbox"
                      checked={!!draft.gradeLode}
                      onChange={(e) => set({ gradeLode: e.target.checked, grade: e.target.checked ? 30 : draft.grade })}
                    />
                    <span>cum laude</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* delete button — shown inside body on mobile, hidden on desktop */}
          {isEditing && (
            <div className="modal-delete-mobile">
              {!confirmDelete ? (
                <button className="btn danger" style={{ width: '100%' }} onClick={() => setConfirmDelete(true)}>
                  Elimina esame
                </button>
              ) : (
                <div className="delete-confirm-row">
                  <span className="delete-confirm-text">Sicuro?</span>
                  <button className="btn danger" onClick={() => onDelete(initial.id)}>Sì, elimina</button>
                  <button className="btn ghost" style={{ padding: '7px 12px' }} onClick={() => setConfirmDelete(false)}>Annulla</button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-ft">
          <div className="modal-delete-desktop">
            {isEditing && !confirmDelete && (
              <button className="btn danger" onClick={() => setConfirmDelete(true)}>
                Elimina esame
              </button>
            )}
            {isEditing && confirmDelete && (
              <div className="delete-confirm-row">
                <span className="delete-confirm-text">Sicuro?</span>
                <button className="btn danger" onClick={() => onDelete(initial.id)}>
                  Sì, elimina
                </button>
                <button className="btn ghost" style={{ padding: '7px 12px' }} onClick={() => setConfirmDelete(false)}>
                  Annulla
                </button>
              </div>
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
