import { useState } from 'react';
import { generateSessionPlan } from '../utils/groq.js';
import { useDialog } from '../hooks/useDialog.js';

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function fmtPickDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function fmtISO(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function PlanCard({ plan, idx, exams, studySlots, onChange, onSelect }) {
  const [editing, setEditing] = useState(false);
  const letters = ['A', 'B', 'C'];

  const byExam = plan.date_picks.reduce((acc, p) => {
    if (!acc[p.examId]) {
      acc[p.examId] = {
        name: exams.find((e) => e.id === p.examId)?.name || p.examId,
        comps: [],
      };
    }
    acc[p.examId].comps.push(p);
    return acc;
  }, {});

  const sortedExams = Object.values(byExam).sort((a, b) => {
    const aMin = Math.min(...a.comps.map((c) => new Date(c.date + 'T00:00:00').getTime()));
    const bMin = Math.min(...b.comps.map((c) => new Date(c.date + 'T00:00:00').getTime()));
    return aMin - bMin;
  });

  return (
    <div className="plan-card">
      <div className="plan-card-hd">
        <span className="plan-letter">{letters[idx]}</span>
        <p className="plan-desc">{plan.rationale}</p>
      </div>

      <div className="plan-picks">
        {sortedExams.map((ep, i) => (
          <div key={i} className="plan-exam-row">
            <span className="plan-exam-name">{ep.name}</span>
            <div className="plan-comp-dates">
              {ep.comps.map((c, j) => (
                <span key={j} className="plan-date-tag">
                  {c.componentName} · {fmtPickDate(c.date)}
                </span>
              ))}
            </div>
          </div>
        ))}
        {plan.study_windows?.length > 0 && (
          <div className="plan-study-note">
            {plan.study_windows.length} materie pianificate nelle fasce selezionate
          </div>
        )}
        {plan.warnings?.length > 0 && (
          <div className="plan-warning-list" role="status">
            {plan.warnings.map((warning) => <span key={warning}>△ {warning}</span>)}
          </div>
        )}
      </div>

      <button
        className="plan-edit-toggle"
        onClick={() => setEditing((value) => !value)}
        aria-expanded={editing}
      >
        {editing ? 'Chiudi modifiche' : 'Modifica piano'}
        <span aria-hidden="true">{editing ? '−' : '+'}</span>
      </button>

      {editing && (
        <div className="plan-editor">
          <div className="plan-editor-section">
            <strong>Materie per fascia</strong>
            <small>Scegli quale materia assegnare stabilmente a ogni momento della giornata.</small>
            {studySlots.filter((slot) => slot.enabled).map((slot, slotIndex) => (
              <label key={`${slot.start}-${slot.end}`} className="plan-slot-assignment">
                <span>{slot.start}–{slot.end}</span>
                <select
                  className="input"
                  value={plan.slot_assignments?.[slotIndex] || ''}
                  onChange={(event) => {
                    const next = [...(plan.slot_assignments || [])];
                    next[slotIndex] = event.target.value || null;
                    onChange({ ...plan, slot_assignments: next });
                  }}
                >
                  <option value="">Assegnazione automatica</option>
                  {plan.study_windows.map((window) => (
                    <option key={window.examId} value={window.examId}>
                      {exams.find((exam) => exam.id === window.examId)?.name || window.examId}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>

          <div className="plan-editor-section">
            <strong>Materie incluse</strong>
            <small>Rimuovi dal piano le materie che vuoi organizzare manualmente.</small>
            <div className="plan-window-list">
              {plan.study_windows.map((window) => (
                <div key={window.examId} className="plan-window-row">
                  <span>{exams.find((exam) => exam.id === window.examId)?.name || window.examId}</span>
                  <button
                    onClick={() => {
                      const nextWindows = plan.study_windows.filter((entry) => entry.examId !== window.examId);
                      const nextAssignments = (plan.slot_assignments || []).map((examId) =>
                        examId === window.examId ? null : examId
                      );
                      onChange({ ...plan, study_windows: nextWindows, slot_assignments: nextAssignments });
                    }}
                    aria-label={`Rimuovi ${exams.find((exam) => exam.id === window.examId)?.name || window.examId}`}
                  >
                    Rimuovi
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={onSelect}>
        Scegli questo piano
      </button>
    </div>
  );
}

export function AIPlanModal({ exams, hasPlan, onSelectPlan, onNoGroqKey, onClose }) {
  const dialogRef = useDialog(onClose);
  const [confirmOverwrite, setConfirmOverwrite] = useState(hasPlan);
  const [preferences, setPreferences] = useState('');
  const [includeStudy, setIncludeStudy] = useState(true);
  const [studyPrefs, setStudyPrefs] = useState({
    studySlots: [
      { start: '09:00', end: '12:00', enabled: true  },
      { start: '14:00', end: '18:00', enabled: true  },
      { start: '20:00', end: '22:00', enabled: true  },
    ],
    studyDays: [1, 2, 3, 4, 5],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState(null);

  const todayISO = fmtISO(new Date());
  const examsWithDates = exams.filter((e) =>
    !['done', 'failed', 'saltato'].includes(e.status)
    && e.components.some((c) => c.dates.some((d) =>
      d.date && d.preference !== 'excluded' && fmtISO(d.date) >= todayISO
    ))
  );

  const generate = async () => {
    const activeSlots = studyPrefs.studySlots.filter((slot) => slot.enabled);
    if (activeSlots.length === 0) {
      setError('Attiva almeno una fascia oraria.');
      return;
    }
    if (activeSlots.some((slot) => !slot.start || !slot.end || slot.start >= slot.end)) {
      setError('Ogni fascia deve avere un orario finale successivo a quello iniziale.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await generateSessionPlan(examsWithDates, preferences, includeStudy, studyPrefs);
      if (!result || result.length === 0) throw new Error('Nessun piano generato. Riprova.');
      const activeSlots = studyPrefs.studySlots.filter((slot) => slot.enabled);
      setPlans(result.map((plan) => ({
        ...plan,
        slot_assignments: activeSlots.map((_, index) =>
          plan.study_windows?.[index % Math.max(plan.study_windows.length, 1)]?.examId || null
        ),
      })));
    } catch (err) {
      if (err.code === 'NO_KEY') { onNoGroqKey(); return; }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Confirm overwrite screen
  if (confirmOverwrite) {
    return (
      <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
        <div ref={dialogRef} className="modal modal--confirm" role="dialog" aria-modal="true" aria-labelledby="replace-plan-title">
          <div className="modal-hd">
            <div>
              <h2 id="replace-plan-title">Sostituire il piano?</h2>
              <div className="sub">Hai già un Piano AI attivo.</div>
            </div>
            <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
          </div>
          <div className="modal-body">
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: 0 }}>
              Generare un nuovo piano <strong>sostituirà quello esistente</strong>, incluse le date scelte e i blocchi di studio. L'operazione non è reversibile.
            </p>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, color: 'var(--ink-soft)', margin: '8px 0 0' }}>
              Sei sicuro di voler continuare?
            </p>
          </div>
          <div className="modal-ft">
            <button className="btn ghost" onClick={onClose}>Annulla</button>
            <button className="btn danger" onClick={() => setConfirmOverwrite(false)}>
              Sì, genera nuovo piano
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={dialogRef} className="modal modal-plan" role="dialog" aria-modal="true" aria-labelledby="ai-plan-title">
        <div className="modal-hd">
          <div>
            <h2 id="ai-plan-title">Piano Sessione AI</h2>
            <div className="sub">
              L'AI sceglie le date migliori tra quelle disponibili e propone 3 alternative.
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body">
          {!plans ? (
            <>
              <div className="field">
                <label className="field-label">Preferenze e priorità</label>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Es: voglio fare prima Reti perché è più semplice, poi Sistemi Operativi scritto e orale insieme, infine Analisi che ha più tempo..."
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                />
                <div className="field-hint">
                  Descrivi liberamente l'ordine preferito, materie da fare prima o dopo, note particolari.
                </div>
              </div>

              {/* Fasce orarie */}
              <div className="field">
                <label className="field-label">Fasce orarie di studio</label>
                {studyPrefs.studySlots.map((slot, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <button
                      className={`pill ${slot.enabled ? 'on' : ''}`}
                      style={{ minWidth: 36, padding: '4px 8px', fontSize: 12 }}
                      aria-pressed={slot.enabled}
                      aria-label={`${slot.enabled ? 'Disattiva' : 'Attiva'} fascia ${i + 1}`}
                      onClick={() => setStudyPrefs((p) => ({
                        ...p,
                        studySlots: p.studySlots.map((s, j) => j === i ? { ...s, enabled: !s.enabled } : s),
                      }))}
                    >
                      {slot.enabled ? '✓' : '○'}
                    </button>
                    <input
                      type="time"
                      className="input"
                      value={slot.start}
                      disabled={!slot.enabled}
                      aria-label={`Inizio fascia ${i + 1}`}
                      style={{ width: 100, padding: '4px 8px', fontSize: 13, opacity: slot.enabled ? 1 : 0.4 }}
                      onChange={(e) => setStudyPrefs((p) => ({
                        ...p,
                        studySlots: p.studySlots.map((s, j) => j === i ? { ...s, start: e.target.value } : s),
                      }))}
                    />
                    <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>→</span>
                    <input
                      type="time"
                      className="input"
                      value={slot.end}
                      disabled={!slot.enabled}
                      aria-label={`Fine fascia ${i + 1}`}
                      style={{ width: 100, padding: '4px 8px', fontSize: 13, opacity: slot.enabled ? 1 : 0.4 }}
                      onChange={(e) => setStudyPrefs((p) => ({
                        ...p,
                        studySlots: p.studySlots.map((s, j) => j === i ? { ...s, end: e.target.value } : s),
                      }))}
                    />
                  </div>
                ))}
                <div className="field-hint">
                  Ogni fascia attiva genera una singola sessione che copre tutto l’intervallo scelto.
                </div>
              </div>

              {/* Giorni di studio */}
              <div className="field">
                <label className="field-label">Giorni di studio</label>
                <div className="pills">
                  {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map((label, i) => {
                    const dayNum = i === 6 ? 0 : i + 1; // 0=Dom, 1=Lun, ...
                    const active = studyPrefs.studyDays.includes(dayNum);
                    return (
                      <button
                        key={dayNum}
                        className={`pill ${active ? 'on' : ''}`}
                        style={{ minWidth: 40 }}
                        onClick={() => setStudyPrefs((p) => ({
                          ...p,
                          studyDays: active
                            ? p.studyDays.filter((d) => d !== dayNum)
                            : [...p.studyDays, dayNum].sort(),
                        }))}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Toggle blocchi di studio */}
              <div className="plan-toggle-row">
                <div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    Includi blocchi di studio
                  </div>
                  <div className="field-hint" style={{ marginTop: 2 }}>
                    Visualizza nel calendario quando studiare ogni materia
                  </div>
                </div>
                <button
                  className={`toggle-sw ${includeStudy ? 'on' : ''}`}
                  onClick={() => setIncludeStudy((v) => !v)}
                  aria-label="Includi blocchi di studio"
                  role="switch"
                  aria-checked={includeStudy}
                />
              </div>

              {error && (
                <div className="ai-error">
                  <span>⚠</span>
                  <span>{error}</span>
                </div>
              )}
            </>
          ) : (
            <div className="plan-cards">
              {plans.map((plan, i) => (
                <PlanCard
                  key={i}
                  plan={plan}
                  idx={i}
                  exams={exams}
                  studySlots={studyPrefs.studySlots}
                  onChange={(nextPlan) => setPlans((current) =>
                    current.map((entry, index) => index === i ? nextPlan : entry)
                  )}
                  onSelect={() => onSelectPlan(plan, studyPrefs)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="modal-ft">
          {!plans ? (
            <>
              <span className="field-hint">
                {examsWithDates.length} esami con date disponibili
              </span>
              <button
                className="btn"
                onClick={generate}
                disabled={loading || examsWithDates.length === 0}
              >
                {loading ? '⟳ Generazione...' : '✦ Genera piano'}
              </button>
            </>
          ) : (
            <>
              <span className="field-hint">Scegli l'alternativa che preferisci</span>
              <button className="btn ghost" onClick={() => setPlans(null)}>
                ← Rigenera
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
