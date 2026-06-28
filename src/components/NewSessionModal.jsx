import { useState } from 'react';
import { useDialog } from '../hooks/useDialog.js';

function fmtDateISO(d) {
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

const DURATIONS = [25, 45, 60, 90, 120];
const BREAKS = [5, 10, 15];
// Etichette giorni con indice getDay() (0 = domenica)
const DAYS = [
  { d: 1, l: 'Lun' }, { d: 2, l: 'Mar' }, { d: 3, l: 'Mer' },
  { d: 4, l: 'Gio' }, { d: 5, l: 'Ven' }, { d: 6, l: 'Sab' }, { d: 0, l: 'Dom' },
];

export function NewSessionModal({ exams, today, onCreate, onClose }) {
  const dialogRef = useDialog(onClose);
  const studyable = exams.filter((e) => !['done', 'failed', 'saltato'].includes(e.status));
  const todayStr = fmtDateISO(today);

  const [examId, setExamId] = useState(studyable[0]?.id || '');
  const [startStr, setStartStr] = useState(fmtDateISO(today));
  const [endStr, setEndStr] = useState(fmtDateISO(new Date(today.getTime() + 6 * 86400000)));
  const [startTime, setStartTime] = useState('14:00');
  const [endTime, setEndTime] = useState('18:00');
  const [sessionMinutes, setSessionMinutes] = useState(120);
  const [breakMinutes, setBreakMinutes] = useState(15);
  const [studyDays, setStudyDays] = useState([1, 2, 3, 4, 5]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleDay = (d) =>
    setStudyDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const valid = examId && startStr && endStr && startStr >= todayStr && startStr <= endStr
    && startTime < endTime && studyDays.length > 0;

  const submit = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      await onCreate({
        examId, startStr, endStr, startTime, endTime,
        sessionMinutes, breakMinutes, studyDays, title, notes,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Impossibile creare le sessioni.');
    } finally {
      setSaving(false);
    }
  };

  const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  return (
    <div className="modal-backdrop" onClick={closeOnBackdrop}>
      <div ref={dialogRef} className="modal modal--compact" role="dialog" aria-modal="true" aria-labelledby="new-session-title">
        <div className="modal-hd">
          <div>
            <h2 id="new-session-title" style={{ margin: 0 }}>Nuova sessione</h2>
            <div className="sub" style={{ marginTop: 2 }}>Genera sessioni indipendenti nell'intervallo di preparazione</div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {studyable.length === 0 ? (
            <div className="task-empty">Aggiungi prima un esame da studiare.</div>
          ) : (
            <>
              <div className="field">
                <label className="field-label">Esame</label>
                <select className="input" value={examId} onChange={(e) => setExamId(e.target.value)}>
                  {studyable.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">Inizio prep.</label>
                  <input className="input" type="date" min={todayStr} value={startStr} onChange={(e) => setStartStr(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">Fine prep.</label>
                  <input className="input" type="date" min={startStr || todayStr} value={endStr} onChange={(e) => setEndStr(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">Dalle</label>
                  <input className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label className="field-label">Alle</label>
                  <input className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Titolo personalizzato <span aria-hidden="true">·</span> opzionale</label>
                <input
                  className="input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="es. Ripasso simulazione"
                />
              </div>

              <div className="field">
                <label className="field-label">Note <span aria-hidden="true">·</span> opzionali</label>
                <textarea
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Obiettivo generale delle sessioni…"
                  rows={2}
                />
              </div>

              <div className="field">
                <label className="field-label">Durata sessione</label>
                <div className="pill-row">
                  {DURATIONS.map((m) => (
                    <button key={m} className={`pill ${sessionMinutes === m ? 'on' : ''}`} onClick={() => setSessionMinutes(m)}>
                      {m < 60 ? `${m}m` : m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h${m % 60}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">Pausa</label>
                <div className="pill-row">
                  {BREAKS.map((m) => (
                    <button key={m} className={`pill ${breakMinutes === m ? 'on' : ''}`} onClick={() => setBreakMinutes(m)}>{m}m</button>
                  ))}
                </div>
              </div>

              <div className="field">
                <label className="field-label">Giorni di studio</label>
                <div className="pill-row">
                  {DAYS.map(({ d, l }) => (
                    <button key={d} className={`pill ${studyDays.includes(d) ? 'on' : ''}`} onClick={() => toggleDay(d)}>{l}</button>
                  ))}
                </div>
              </div>

              {!valid && (
                <div className="field-hint" style={{ color: 'var(--warn)' }}>
                  Controlla intervallo date, orari e almeno un giorno selezionato.
                </div>
              )}
              {error && <div className="ai-error" role="alert">{error}</div>}
            </>
          )}
        </div>

        <div className="modal-ft">
          <button className="btn ghost" onClick={onClose}>Annulla</button>
          <button className="btn" onClick={submit} disabled={!valid || saving}>
            {saving ? 'Creazione…' : 'Crea sessioni'}
          </button>
        </div>
      </div>
    </div>
  );
}
