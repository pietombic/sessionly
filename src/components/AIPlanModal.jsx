import { useState } from 'react';
import { generateSessionPlan } from '../utils/groq.js';

const MONTHS_SHORT = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'];

function fmtPickDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

function PlanCard({ plan, idx, exams, onSelect }) {
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
        <p className="plan-desc">{plan.description}</p>
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
            + {plan.study_windows.length} blocchi di studio
          </div>
        )}
      </div>

      <button className="btn" style={{ width: '100%', marginTop: 12 }} onClick={onSelect}>
        Scegli questo piano
      </button>
    </div>
  );
}

export function AIPlanModal({ exams, hasPlan, onSelectPlan, onNoGroqKey, onClose }) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(hasPlan);
  const [preferences, setPreferences] = useState('');
  const [includeStudy, setIncludeStudy] = useState(true);
  const [studyPrefs, setStudyPrefs] = useState({
    morning: false,
    afternoon: true,
    evening: false,
    sessionHours: 2,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [plans, setPlans] = useState(null);

  const examsWithDates = exams.filter((e) =>
    e.components.some((c) => c.dates.some((d) => d.date))
  );

  const togglePref = (key) => setStudyPrefs((p) => ({ ...p, [key]: !p[key] }));

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateSessionPlan(exams, preferences, includeStudy, studyPrefs);
      if (!result || result.length === 0) throw new Error('Nessun piano generato. Riprova.');
      setPlans(result);
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
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="modal-hd">
            <div>
              <h2>Sostituire il piano?</h2>
              <div className="sub">Hai già un Piano AI attivo.</div>
            </div>
            <button className="modal-close" onClick={onClose}>✕</button>
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
      <div className="modal modal-plan">
        <div className="modal-hd">
          <div>
            <h2>Piano Sessione AI</h2>
            <div className="sub">
              L'AI sceglie le date migliori tra quelle disponibili e propone 3 alternative.
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
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

              {/* Orari studio */}
              <div className="field">
                <label className="field-label">Orari di studio preferiti</label>
                <div className="pills">
                  {[
                    { key: 'morning',   label: 'Mattina 9–12' },
                    { key: 'afternoon', label: 'Pomeriggio 14–18' },
                    { key: 'evening',   label: 'Sera 19–22' },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      className={`pill ${studyPrefs[key] ? 'on' : ''}`}
                      onClick={() => togglePref(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Durata sessione */}
              <div className="field">
                <label className="field-label">Durata sessione di studio</label>
                <div className="pills">
                  {[1, 1.5, 2, 3].map((h) => (
                    <button
                      key={h}
                      className={`pill ${studyPrefs.sessionHours === h ? 'on' : ''}`}
                      onClick={() => setStudyPrefs((p) => ({ ...p, sessionHours: h }))}
                    >
                      {h}h poi pausa
                    </button>
                  ))}
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
                  onSelect={() => onSelectPlan(plan)}
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
