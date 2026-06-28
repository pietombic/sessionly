import { useState, useRef } from 'react';
import { TAG_COLORS, TYPES } from '../data.js';
import { loadScore, statusLabel, startOfDay } from '../utils/dates.js';
import { CustomSlider, LoadBadge } from './ui/index.jsx';
import { extractExamFromDescription } from '../utils/groq.js';
import { useDialog } from '../hooks/useDialog.js';

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
  remainingHours: '',
  completedHours: '',
  preparationPercent: 0,
  targetGrade: 'pass',
  reviewBufferDays: 1,
  preferredTime: 'any',
  preferredBlockLength: 'medium',
  componentDependency: 'independent',
  missingMaterial: '',
  materials: {
    book: false,
    notes: false,
    exercises: false,
    pastExams: false,
  },
  attemptHistory: {
    count: 0,
    lastGrade: '',
    issues: '',
  },
  topicItems: [],
  components: [
    { name: 'Scritto', dates: [{ id: 'n1', date: null, time: '', room: '', locked: false, preference: 'alternative' }] },
    { name: 'Orale',   dates: [{ id: 'n2', date: null, time: '', room: '', locked: false, preference: 'alternative' }] },
  ],
};

function reviveDates(key, val) {
  if (key === 'date' && typeof val === 'string') return new Date(val);
  return val;
}

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

function topicId() {
  return `topic_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function normalizeExam(source) {
  const legacyTopics = typeof source?.topics === 'string'
    ? source.topics.split('\n').map((name) => name.trim()).filter(Boolean)
    : [];
  const existingTopics = Array.isArray(source?.topicItems) ? source.topicItems : [];

  return {
    ...blank,
    ...source,
    materials: { ...blank.materials, ...(source?.materials || {}) },
    attemptHistory: { ...blank.attemptHistory, ...(source?.attemptHistory || {}) },
    topicItems: existingTopics.length
      ? existingTopics.map((topic) => ({
          id: topic.id || topicId(),
          name: topic.name || '',
          status: topic.status || 'todo',
          difficulty: Number(topic.difficulty || 5),
          estimatedHours: topic.estimatedHours ?? '',
          importance: topic.importance || 'normal',
        }))
      : legacyTopics.map((name) => ({
          id: topicId(),
          name,
          status: 'todo',
          difficulty: 5,
          estimatedHours: '',
          importance: 'normal',
        })),
    components: (source?.components || blank.components).map((component) => ({
      ...component,
      dates: component.dates.map((date) => ({
        ...date,
        preference: date.preference || 'alternative',
      })),
    })),
  };
}

export function ExamForm({ initial, allExams = [], sliderStyle, today, onClose, onSave, onDelete, onNoGroqKey }) {
  const isEditing = !!initial;
  const dialogRef = useDialog(onClose);

  const [draft, setDraft] = useState(() => {
    if (!initial) return normalizeExam(null);
    return normalizeExam(JSON.parse(JSON.stringify(initial), reviveDates));
  });

  // ── voice / AI section ──────────────────────────────────────────────────
  const [showProgramDetails, setShowProgramDetails] = useState(
    !!(
      initial?.topics
      || initial?.topicItems?.length
      || initial?.pages
      || initial?.examApproach
      || initial?.materialDesc
      || initial?.missingMaterial
      || initial?.attemptHistory?.count
    )
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [voiceText, setVoiceText] = useState('');
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceError, setVoiceError] = useState('');
  const [recording, setRecording] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
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
              preference: d.preference || 'alternative',
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
        ...(extracted.topics?.length ? {
          topics: extracted.topics.join('\n'),
          topicItems: extracted.topics.map((name) => ({
            id: topicId(),
            name,
            status: 'todo',
            difficulty: 5,
            estimatedHours: '',
            importance: 'normal',
          })),
        } : {}),
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
          dates: [{ id: 'n_' + cname + Date.now(), date: null, time: '', room: '', locked: false, preference: 'alternative' }],
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
      dates: [...c.dates, { id: 'n_' + Date.now(), date: null, time: '', room: '', locked: false, preference: 'alternative' }],
    }));

  const removeDate = (ci, dateId) =>
    setComp(ci, (c) => ({ ...c, dates: c.dates.filter((d) => d.id !== dateId) }));

  const updateDate = (ci, dateId, patch) =>
    setComp(ci, (c) => ({
      ...c,
      dates: c.dates.map((d) => (d.id === dateId ? { ...d, ...patch } : d)),
    }));

  const toggleDateLock = (ci, dateId) =>
    setComp(ci, (component) => {
      const target = component.dates.find((date) => date.id === dateId);
      const nextLocked = !target?.locked;
      return {
        ...component,
        dates: component.dates.map((date) => date.id === dateId
          ? {
              ...date,
              locked: nextLocked,
              ...(nextLocked && date.preference === 'excluded' ? { preference: 'alternative' } : {}),
            }
          : (nextLocked ? { ...date, locked: false } : date)
        ),
      };
    });

  const updateDatePreference = (ci, dateId, preference) =>
    setComp(ci, (component) => ({
      ...component,
      dates: component.dates.map((date) => {
        if (date.id === dateId) return { ...date, preference };
        if (preference === 'preferred' && date.preference === 'preferred') {
          return { ...date, preference: 'alternative' };
        }
        return date;
      }),
    }));

  const set = (patch) => setDraft((prev) => ({ ...prev, ...patch }));

  const updateTopic = (id, patch) => setDraft((prev) => ({
    ...prev,
    topicItems: prev.topicItems.map((topic) => topic.id === id ? { ...topic, ...patch } : topic),
  }));

  const addTopic = () => setDraft((prev) => ({
    ...prev,
    topicItems: [...prev.topicItems, {
      id: topicId(),
      name: '',
      status: 'todo',
      difficulty: 5,
      estimatedHours: '',
      importance: 'normal',
    }],
  }));

  const removeTopic = (id) => setDraft((prev) => ({
    ...prev,
    topicItems: prev.topicItems.filter((topic) => topic.id !== id),
  }));

  const submit = async () => {
    if (!draft.name.trim()) {
      setFormError('Inserisci il nome dell’esame.');
      return;
    }
    setFormError('');
    const cleanTopics = draft.topicItems
      .filter((topic) => topic.name.trim())
      .map((topic) => ({ ...topic, name: topic.name.trim() }));
    setSaving(true);
    try {
      await onSave({
        ...draft,
        name: draft.name.trim(),
        code: draft.code.trim(),
        topicItems: cleanTopics,
        topics: cleanTopics.map((topic) => topic.name).join('\n'),
      });
    } catch (error) {
      setFormError(error.message || 'Impossibile salvare l’esame.');
    } finally {
      setSaving(false);
    }
  };

  const deleteCurrentExam = async () => {
    if (!initial?.id || deleting) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
    } catch (error) {
      setFormError(error.message || 'Impossibile eliminare l’esame.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  const planningDates = draft.components
    .map((component) => component.dates
      .map((date) => ({ ...date, componentName: component.name }))
      .filter((date) => date.date && date.preference !== 'excluded')
      .sort((a, b) => {
        const rank = (entry) => entry.locked ? 0 : entry.preference === 'preferred' ? 1 : 2;
        return rank(a) - rank(b) || a.date - b.date;
      })[0]
    )
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
  const targetDate = planningDates[0]?.date || null;
  const baseToday = startOfDay(today || new Date());
  const daysToTarget = targetDate
    ? Math.max(0, Math.ceil((startOfDay(targetDate) - baseToday) / 86400000))
    : null;
  const usableDays = daysToTarget == null
    ? null
    : Math.max(0, daysToTarget - Number(draft.reviewBufferDays || 0));
  const remainingHours = Number(draft.remainingHours || 0);
  const topicRemainingHours = draft.topicItems
    .filter((topic) => topic.status !== 'ready')
    .reduce((sum, topic) => sum + Number(topic.estimatedHours || 0), 0);
  const planningHours = remainingHours > 0 ? remainingHours : topicRemainingHours;
  const blockHours = draft.preferredBlockLength === 'short'
    ? 1
    : draft.preferredBlockLength === 'long' ? 3 : 2;
  const estimatedSessions = planningHours > 0 ? Math.ceil(planningHours / blockHours) : null;
  const hoursPerDay = planningHours > 0 && usableDays > 0 ? planningHours / usableDays : null;
  const targetDateKey = targetDate ? toInputDate(targetDate) : null;
  const overlappingExams = targetDateKey
    ? allExams.filter((exam) =>
        exam.id !== initial?.id
        && exam.components?.some((component) =>
          component.dates?.some((date) => date.date && toInputDate(date.date) === targetDateKey)
        )
      )
    : [];
  const feasibility = !targetDate
    ? { tone: 'neutral', title: 'Aggiungi almeno un appello', text: 'Il riepilogo sarà disponibile quando inserirai una data valida.' }
    : planningHours <= 0
      ? { tone: 'neutral', title: `${daysToTarget} giorni disponibili`, text: 'Indica le ore rimanenti per stimare il carico del piano.' }
      : usableDays <= 0
        ? { tone: 'danger', title: 'Tempo insufficiente', text: 'Il buffer scelto occupa tutti i giorni disponibili prima dell’esame.' }
        : hoursPerDay > 4
          ? { tone: 'danger', title: 'Piano molto intenso', text: `Servirebbero circa ${hoursPerDay.toFixed(1)} ore al giorno.` }
          : hoursPerDay > 2.5
            ? { tone: 'warning', title: 'Piano impegnativo', text: `Servirebbero circa ${hoursPerDay.toFixed(1)} ore al giorno.` }
            : { tone: 'good', title: 'Carico sostenibile', text: `Circa ${hoursPerDay.toFixed(1)} ore al giorno per arrivare al buffer.` };

  return (
    <div className="modal-backdrop exam-form-backdrop" onClick={onClose}>
      <div
        ref={dialogRef}
        className="modal modal--form exam-form-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exam-form-title"
      >
        <div className="modal-hd">
          <div>
            <span className="exam-form-eyebrow">{isEditing ? 'Editor esame' : 'Nuovo esame'}</span>
            <h2 id="exam-form-title">{isEditing ? draft.name || 'Modifica esame' : 'Aggiungi un esame'}</h2>
            <div className="sub">
              {isEditing
                ? 'Aggiorna informazioni, appelli e stato di preparazione.'
                : 'Inserisci le informazioni essenziali. Potrai modificarle in qualsiasi momento.'}
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body scroll">

          {/* ── AI voice section ──────────────────── */}
          {showVoice ? (
            <div className="voice-section exam-ai-panel">
              <div className="exam-ai-panel-head">
                <div>
                  <span className="field-label">Compilazione assistita</span>
                  <strong>Descrivi l’esame con parole tue</strong>
                </div>
                <button className="modal-close exam-ai-close" onClick={() => { setShowVoice(false); setVoiceError(''); }} aria-label="Chiudi compilazione assistita">✕</button>
              </div>
              <textarea
                className="input exam-ai-textarea"
                placeholder={'es. "Ho un esame di Analisi II il 24 giugno. C\'è tanto da studiare, è difficile. C\'è anche un orale il 7 luglio."'}
                value={voiceText}
                onChange={(e) => { setVoiceText(e.target.value); setVoiceError(''); }}
                autoFocus
              />
              <div className="exam-ai-actions">
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
                  <span className="exam-inline-error">⚠ {voiceError}</span>
                )}
                <button
                  className={`ai-btn exam-ai-submit ${voiceLoading ? 'loading' : ''}`}
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
              className="exam-ai-trigger"
              onClick={() => setShowVoice(true)}
            >
              <span className="exam-ai-trigger-icon">✦</span>
              <span>
                <strong>Compila con l’AI</strong>
                <small>Descrivi l’esame e prepara automaticamente il modulo</small>
              </span>
              <span aria-hidden="true">→</span>
            </button>
          )}

          {/* ── basics ─────────────────────────────── */}
          <section className="exam-form-section">
            <div className="exam-form-section-head">
              <span>01</span>
              <div>
                <h3>Informazioni principali</h3>
                <p>Nome, codice e colore usato nel calendario.</p>
              </div>
            </div>
            <div className="exam-form-section-body">
            <div className="name-code-grid">
              <div className="field">
                <label className="field-label" htmlFor="exam-name">Nome esame</label>
                <input
                  id="exam-name"
                  className="input"
                  value={draft.name}
                  placeholder="es. Analisi Matematica II"
                  onChange={(e) => {
                    set({ name: e.target.value });
                    if (formError) setFormError('');
                  }}
                  aria-invalid={!!formError}
                />
                {formError && <div className="exam-field-error" role="alert">{formError}</div>}
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
          </section>

          {/* ── exam type ──────────────────────────── */}
          <section className="exam-form-section">
            <div className="exam-form-section-head">
              <span>02</span>
              <div>
                <h3>Struttura dell’esame</h3>
                <p>Scegli le prove previste. Potrai inserire più appelli per ogni componente.</p>
              </div>
            </div>
            <div className="exam-form-section-body">
            <div className="type-grid">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  className={`type-card ${draft.type === t.id ? 'on' : ''}`}
                  onClick={() => onTypeChange(t.id)}
                >
                  <span className="ttype-icon">{t.short}</span>
                  <span className="type-card-copy">
                    <strong>{t.label}</strong>
                    <small>{t.components.join(' + ')}</small>
                  </span>
                  <span className="type-card-check" aria-hidden="true">{draft.type === t.id ? '✓' : ''}</span>
                </button>
              ))}
            </div>
            </div>
          </section>

          {/* ── sliders ──────────────────────────── */}
          <section className="exam-form-section">
            <div className="exam-form-section-head">
              <span>03</span>
              <div>
                <h3>Carico di preparazione</h3>
                <p>Aiuta il piano a distribuire correttamente tempo e priorità.</p>
              </div>
            </div>
            <div className="exam-form-section-body exam-workload-body">
            <div className="exam-preparation-grid">
              <div className="field">
                <label className="field-label">Ore ancora necessarie</label>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    className="input mono"
                    min={0}
                    step={0.5}
                    placeholder="es. 45"
                    value={draft.remainingHours}
                    onChange={(e) => set({ remainingHours: e.target.value })}
                  />
                  <span>ore</span>
                </div>
                <div className="field-hint">La stima più utile per dimensionare il piano.</div>
              </div>
              <div className="field">
                <label className="field-label">Ore già svolte</label>
                <div className="input-with-suffix">
                  <input
                    type="number"
                    className="input mono"
                    min={0}
                    step={0.5}
                    placeholder="es. 12"
                    value={draft.completedHours}
                    onChange={(e) => set({ completedHours: e.target.value })}
                  />
                  <span>ore</span>
                </div>
              </div>
              <div className="field preparation-field">
                <label className="field-label">Preparazione attuale</label>
                <div className="preparation-control">
                  <div className="preparation-segments" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, index) => (
                      <span
                        key={index}
                        className={index * 10 < draft.preparationPercent ? 'is-active' : ''}
                      />
                    ))}
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={draft.preparationPercent}
                    onChange={(e) => set({ preparationPercent: Number(e.target.value) })}
                    aria-label="Percentuale di preparazione attuale"
                  />
                  <strong>{draft.preparationPercent}%</strong>
                </div>
                <div className="field-hint">Quanto ti senti pronto oggi, considerando tutto il programma.</div>
              </div>
            </div>

            <div className="exam-subsection-label">
              <span>Valutazione qualitativa</span>
              <small>Serve a distinguere quantità di lavoro e difficoltà concettuale.</small>
            </div>
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
                  ariaLabel="Effort dell’esame"
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
                  ariaLabel="Difficoltà dell’esame"
                />
                <div className="scale"><span>Accessibile</span><span>Ostico</span></div>
              </div>
            </div>
            <div className="exam-load-badge">
              <LoadBadge effort={draft.effort} difficulty={draft.difficulty} />
            </div>

          {/* ── CFU & Open Book ─────────────────── */}
          <div className="exam-two-column">
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
            <div className="field exam-partial-panel">
              <label className="field-label">Stato parziali</label>
              <div className="exam-partial-row">
                <button
                  className={`toggle-lock ${draft.partial1Done ? 'on' : ''}`}
                  onClick={() => set({ partial1Done: !draft.partial1Done })}
                >
                  {draft.partial1Done ? '✓' : '○'} Parziale 1 sostenuto
                </button>
                {draft.partial1Done && (
                  <div className="exam-partial-grade">
                    <span>Voto:</span>
                    <input
                      type="number"
                      className="input mono exam-grade-input"
                      min={0} max={31}
                      value={draft.partial1Grade}
                      onChange={(e) => set({ partial1Grade: Number(e.target.value) })}
                    />
                    <span>/30</span>
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
            </div>
          </section>

          {/* ── components & dates ────────────────── */}
          <section className="exam-form-section">
            <div className="exam-form-section-head">
              <span>04</span>
              <div>
                <h3>Date e appelli</h3>
                <p>Inserisci data, ora e aula. Blocca una data se non deve essere spostata dal piano.</p>
              </div>
            </div>
            <div className="exam-form-section-body exam-dates-body">
          {draft.components.length > 1 && (
            <div className="field exam-dependency-field">
              <label className="field-label">Relazione tra le prove</label>
              <select
                className="input"
                value={draft.componentDependency}
                onChange={(e) => set({ componentDependency: e.target.value })}
              >
                <option value="independent">Le prove sono indipendenti</option>
                <option value="sequential">La prova successiva richiede il superamento della precedente</option>
                <option value="wait-result">Devo attendere il risultato prima della prova successiva</option>
                <option value="same-session">Le prove devono essere sostenute nella stessa sessione</option>
              </select>
            </div>
          )}
          <div className="exam-lock-explanation">
            <span aria-hidden="true">🔒</span>
            <span><strong>Data bloccata</strong> significa che l’appello è fisso o unico e deve essere rispettato dal piano.</span>
          </div>
          {draft.components.map((comp, ci) => (
            <div key={comp.name} className="date-component">
              <div className="comp-hd">
                <h4>{comp.name}</h4>
                <button className="btn-text exam-add-date" onClick={() => addDate(ci)}>+ Aggiungi appello</button>
              </div>
              <div className="date-rows">
                {comp.dates.map((dt) => (
                  <div key={dt.id} className={`date-row ${dt.locked ? 'locked' : ''}`}>
                    <input
                      type="date"
                      className="input mono"
                      value={toInputDate(dt.date)}
                      onChange={(e) => updateDate(ci, dt.id, { date: fromInputDate(e.target.value) })}
                    />
                    <input
                      type="time"
                      className="input mono"
                      value={dt.time}
                      onChange={(e) => updateDate(ci, dt.id, { time: e.target.value })}
                    />
                    <input
                      className="input"
                      placeholder="Sede / aula"
                      value={dt.room}
                      onChange={(e) => updateDate(ci, dt.id, { room: e.target.value })}
                    />
                    <select
                      className="input date-preference-select"
                      value={dt.preference || 'alternative'}
                      onChange={(e) => updateDatePreference(ci, dt.id, e.target.value)}
                      aria-label={`Preferenza appello ${comp.name}`}
                    >
                      <option value="preferred">Preferito</option>
                      <option value="alternative">Alternativo</option>
                      <option value="excluded" disabled={dt.locked}>Escludi dal piano</option>
                    </select>
                    <button
                      className={`toggle-lock ${dt.locked ? 'on' : ''}`}
                      onClick={() => toggleDateLock(ci, dt.id)}
                      title="Data bloccata: non spostabile"
                    >
                      {dt.locked ? '🔒' : '○'} {dt.locked ? 'Bloccata' : 'Flessibile'}
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
            </div>
          </section>

          {/* ── priority & status ───────────────── */}
          <section className="exam-form-section">
            <div className="exam-form-section-head">
              <span>05</span>
              <div>
                <h3>Organizzazione</h3>
                <p>Definisci priorità, stato attuale e note personali.</p>
              </div>
            </div>
            <div className="exam-form-section-body">
          <div className="exam-planning-preferences">
            <div className="field">
              <label className="field-label">Obiettivo</label>
              <select className="input" value={draft.targetGrade} onChange={(e) => set({ targetGrade: e.target.value })}>
                <option value="pass">Superare l’esame</option>
                <option value="24">Puntare almeno al 24</option>
                <option value="27">Puntare almeno al 27</option>
                <option value="30">Puntare al 30</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Buffer prima dell’esame</label>
              <select className="input" value={draft.reviewBufferDays} onChange={(e) => set({ reviewBufferDays: Number(e.target.value) })}>
                <option value={0}>Nessun buffer</option>
                <option value={1}>1 giorno solo ripasso</option>
                <option value={2}>2 giorni per ripasso e simulazioni</option>
                <option value={3}>3 giorni di consolidamento</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Momento preferito</label>
              <select className="input" value={draft.preferredTime} onChange={(e) => set({ preferredTime: e.target.value })}>
                <option value="any">Indifferente</option>
                <option value="morning">Mattina</option>
                <option value="afternoon">Pomeriggio</option>
                <option value="evening">Sera</option>
              </select>
            </div>
            <div className="field">
              <label className="field-label">Durata ideale dei blocchi</label>
              <select className="input" value={draft.preferredBlockLength} onChange={(e) => set({ preferredBlockLength: e.target.value })}>
                <option value="short">Brevi · circa 1 ora</option>
                <option value="medium">Medie · circa 2 ore</option>
                <option value="long">Lunghe · circa 3 ore</option>
              </select>
            </div>
          </div>
          <div className="exam-two-column">
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
          </section>

          {/* ── program details (collapsible) ─── */}
          <div className="program-details-section">
            <button
              type="button"
              className="program-details-toggle"
              onClick={() => setShowProgramDetails((v) => !v)}
            >
              <span>{showProgramDetails ? '▾' : '▸'}</span>
              Programma, materiali e storico
              {Boolean(
                draft.examApproach
                || draft.pages
                || draft.topicItems.length
                || draft.materialDesc
                || draft.attemptHistory.count
              ) && (
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

                <div className="exam-two-column">
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
                  <div className="topic-list-head">
                    <div>
                      <label className="field-label">Checklist degli argomenti</label>
                      <div className="field-hint">Sei tu a definire i contenuti; il piano usa stato e ore per stimare il lavoro.</div>
                    </div>
                    <button className="btn-text exam-add-date" type="button" onClick={addTopic}>+ Argomento</button>
                  </div>
                  {draft.topicItems.length === 0 ? (
                    <button className="topic-empty-state" type="button" onClick={addTopic}>
                      Aggiungi il primo argomento del programma
                    </button>
                  ) : (
                    <div className="topic-editor-list">
                      {draft.topicItems.map((topic) => (
                        <div className="topic-editor-row" key={topic.id}>
                          <input
                            className="input topic-name-input"
                            value={topic.name}
                            placeholder="Nome argomento"
                            onChange={(e) => updateTopic(topic.id, { name: e.target.value })}
                          />
                          <select
                            className="input topic-status"
                            value={topic.status}
                            onChange={(e) => updateTopic(topic.id, { status: e.target.value })}
                            aria-label={`Stato ${topic.name || 'argomento'}`}
                          >
                            <option value="todo">Da iniziare</option>
                            <option value="studying">In studio</option>
                            <option value="review">Da ripassare</option>
                            <option value="ready">Pronto</option>
                          </select>
                          <select
                            className="input topic-importance"
                            value={topic.importance}
                            onChange={(e) => updateTopic(topic.id, { importance: e.target.value })}
                            aria-label={`Importanza ${topic.name || 'argomento'}`}
                          >
                            <option value="low">Secondario</option>
                            <option value="normal">Normale</option>
                            <option value="high">Fondamentale</option>
                          </select>
                          <select
                            className="input topic-difficulty"
                            value={topic.difficulty}
                            onChange={(e) => updateTopic(topic.id, { difficulty: Number(e.target.value) })}
                            aria-label={`Difficoltà ${topic.name || 'argomento'}`}
                          >
                            <option value={3}>Semplice</option>
                            <option value={5}>Media</option>
                            <option value={8}>Difficile</option>
                          </select>
                          <div className="input-with-suffix topic-hours">
                            <input
                              className="input mono"
                              type="number"
                              min={0}
                              step={0.5}
                              value={topic.estimatedHours}
                              placeholder="Ore"
                              onChange={(e) => updateTopic(topic.id, { estimatedHours: e.target.value })}
                            />
                            <span>h</span>
                          </div>
                          <button className="icon-x" type="button" onClick={() => removeTopic(topic.id)} aria-label={`Rimuovi ${topic.name || 'argomento'}`}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="field">
                  <label className="field-label">Materiale disponibile</label>
                  <div className="material-check-grid">
                    {[
                      ['book', 'Libro o manuale'],
                      ['notes', 'Dispense o slide'],
                      ['exercises', 'Esercizi'],
                      ['pastExams', 'Prove degli anni precedenti'],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        className={`material-check ${draft.materials[key] ? 'on' : ''}`}
                        onClick={() => set({
                          materials: { ...draft.materials, [key]: !draft.materials[key] },
                        })}
                        aria-pressed={draft.materials[key]}
                      >
                        <span>{draft.materials[key] ? '✓' : '○'}</span>{label}
                      </button>
                    ))}
                  </div>
                  <textarea
                    className="input exam-material-input"
                    placeholder={'es. Libro di testo (Cormen), 8 slide del prof, raccolta esercizi anni passati…'}
                    value={draft.materialDesc}
                    onChange={(e) => set({ materialDesc: e.target.value })}
                  />
                  <div className="field-hint">Descrivi cosa hai a disposizione: libri, slide, esercizi, video…</div>
                </div>

                <div className="field">
                  <label className="field-label">Materiale ancora mancante</label>
                  <input
                    className="input"
                    value={draft.missingMaterial}
                    placeholder="es. Soluzioni delle prove 2025"
                    onChange={(e) => set({ missingMaterial: e.target.value })}
                  />
                </div>

                <div className="exam-history-panel">
                  <div>
                    <label className="field-label">Tentativi precedenti</label>
                    <div className="field-hint">Informazioni opzionali per non ripetere gli stessi errori.</div>
                  </div>
                  <div className="exam-history-grid">
                    <div className="field">
                      <label className="field-label">Numero tentativi</label>
                      <input
                        type="number"
                        min={0}
                        className="input mono"
                        value={draft.attemptHistory.count}
                        onChange={(e) => set({
                          attemptHistory: { ...draft.attemptHistory, count: Number(e.target.value) },
                        })}
                      />
                    </div>
                    <div className="field">
                      <label className="field-label">Ultimo voto/esito</label>
                      <input
                        className="input"
                        value={draft.attemptHistory.lastGrade}
                        placeholder="es. 17 oppure ritirato"
                        onChange={(e) => set({
                          attemptHistory: { ...draft.attemptHistory, lastGrade: e.target.value },
                        })}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label">Problemi riscontrati</label>
                    <textarea
                      className="input"
                      value={draft.attemptHistory.issues}
                      placeholder="es. Poco tempo negli esercizi, insicurezza sugli integrali…"
                      onChange={(e) => set({
                        attemptHistory: { ...draft.attemptHistory, issues: e.target.value },
                      })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className={`exam-feasibility exam-feasibility--${feasibility.tone}`}>
            <div className="exam-feasibility-icon" aria-hidden="true">
              {feasibility.tone === 'good' ? '✓' : feasibility.tone === 'danger' ? '!' : feasibility.tone === 'warning' ? '△' : 'i'}
            </div>
            <div className="exam-feasibility-copy">
              <span className="field-label">Impatto sul piano</span>
              <strong>{feasibility.title}</strong>
              <p>{feasibility.text}</p>
            </div>
            <div className="exam-feasibility-stats">
              <span><strong>{daysToTarget ?? '—'}</strong><small>giorni</small></span>
              <span><strong>{estimatedSessions ?? '—'}</strong><small>sessioni</small></span>
              <span><strong>{overlappingExams.length}</strong><small>conflitti</small></span>
            </div>
            {overlappingExams.length > 0 && (
              <div className="exam-feasibility-warning">
                Nella stessa data: {overlappingExams.map((exam) => exam.name).join(', ')}
              </div>
            )}
          </div>

          {/* ── exam outcome (shown only when date has passed) ── */}
          {examHasPassed && (
            <div className="outcome-section">
              <div className="field-label outcome-title">Com'è andata?</div>
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
                  <button className="btn danger" onClick={deleteCurrentExam} disabled={deleting}>
                    {deleting ? 'Eliminazione…' : 'Sì, elimina'}
                  </button>
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
                <button className="btn danger" onClick={deleteCurrentExam} disabled={deleting}>
                  {deleting ? 'Eliminazione…' : 'Sì, elimina'}
                </button>
                <button className="btn ghost" onClick={() => setConfirmDelete(false)}>
                  Annulla
                </button>
              </div>
            )}
          </div>
          <div className="exam-form-primary-actions">
            <button className="btn ghost" onClick={onClose}>Annulla</button>
            <button className="btn" onClick={submit} disabled={saving || deleting}>
              {saving ? 'Salvataggio…' : isEditing ? 'Salva modifiche' : 'Aggiungi esame'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
