import { useState, useEffect, useCallback } from 'react';
import {
  fetchEventTasks, createEventTask,
  fetchTasksForEvent, createSessionTask,
  updateEventTask, deleteEventTask,
} from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { useDialog } from '../hooks/useDialog.js';

function fmtDateISO(d) {
  if (!d) return '';
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function EventDetailModal({
  detail,
  onSaveExamDate,
  onUpdateSession,
  onDeleteSession,
  onOpenFullEditor,
  onClose,
}) {
  const dialogRef = useDialog(onClose);
  const isSession = detail.type === 'session';
  const isExam = detail.type === 'exam';

  // ── Task state ────────────────────────────────────────────────────────────
  const [tasks, setTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskTime, setNewTaskTime] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [loadingTasks, setLoadingTasks] = useState(false);

  // ── Exam local edit state ─────────────────────────────────────────────────
  const [localDate, setLocalDate] = useState(isExam ? fmtDateISO(detail.date) : '');
  const [localTime, setLocalTime] = useState(isExam ? (detail.time || '') : '');
  const [localRoom, setLocalRoom] = useState(isExam ? (detail.room || '') : '');

  // ── Session local edit state ──────────────────────────────────────────────
  const [localTitle, setLocalTitle] = useState(
    isSession ? (detail.title || detail.examName || '') : ''
  );
  const [localNotes, setLocalNotes] = useState(isSession ? (detail.notes || '') : '');
  const sessionStart = isSession && detail.startISO ? new Date(detail.startISO) : null;
  const sessionEnd = isSession && detail.endISO ? new Date(detail.endISO) : null;
  const [sessionDate, setSessionDate] = useState(sessionStart ? fmtDateISO(sessionStart) : '');
  const [sessionStartTime, setSessionStartTime] = useState(
    sessionStart
      ? `${String(sessionStart.getHours()).padStart(2, '0')}:${String(sessionStart.getMinutes()).padStart(2, '0')}`
      : (detail.startTime || '')
  );
  const [sessionEndTime, setSessionEndTime] = useState(
    sessionEnd
      ? `${String(sessionEnd.getHours()).padStart(2, '0')}:${String(sessionEnd.getMinutes()).padStart(2, '0')}`
      : (detail.endTime || '')
  );
  const [completed, setCompleted] = useState(isSession ? !!detail.completed : false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sessionTimeError, setSessionTimeError] = useState('');
  const [actionError, setActionError] = useState('');

  const [saving, setSaving] = useState(false);

  // refKey only used for exam-date tasks
  const refKey = isExam
    ? `exam:${detail.examId}:${detail.componentName}:${fmtDateISO(detail.date)}`
    : null;

  const loadTasks = useCallback(() => {
    setLoadingTasks(true);
    const p = isSession ? fetchTasksForEvent(detail.eventId) : fetchEventTasks(refKey);
    p.then((data) => setTasks(data || []))
      .catch(() => setTasks([]))
      .finally(() => setLoadingTasks(false));
  }, [isSession, detail.eventId, refKey]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Task handlers ─────────────────────────────────────────────────────────
  const addTask = async () => {
    const text = newTaskText.trim();
    if (!text) return;

    const tempId = 'tmp_' + Date.now();
    setTasks((prev) => [...prev, {
      id: tempId, text, completed: false, position: prev.length,
      scheduled_time: newTaskTime || null,
    }]);
    setNewTaskText('');
    setNewTaskTime('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const created = isSession
        ? await createSessionTask(detail.eventId, text, user?.id, newTaskTime)
        : await createEventTask(refKey, text, user?.id, newTaskTime);
      if (created) setTasks((prev) => prev.map((t) => t.id === tempId ? created : t));
      else setTasks((prev) => prev.filter((t) => t.id !== tempId));
    } catch {
      setTasks((prev) => prev.filter((t) => t.id !== tempId));
    }
  };

  const toggleTask = async (task) => {
    const updated = { ...task, completed: !task.completed };
    setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    try {
      await updateEventTask(task.id, { completed: updated.completed });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? task : t));
    }
  };

  const startEdit = (task) => { setEditingId(task.id); setEditText(task.text); };

  const saveEdit = async (taskId) => {
    if (!editText.trim()) { setEditingId(null); return; }
    const oldTask = tasks.find((t) => t.id === taskId);
    const updated = { ...oldTask, text: editText.trim() };
    setTasks((prev) => prev.map((t) => t.id === taskId ? updated : t));
    setEditingId(null);
    try {
      await updateEventTask(taskId, { text: editText.trim() });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === taskId ? oldTask : t));
    }
  };

  const removeTask = async (taskId) => {
    const removed = tasks.find((t) => t.id === taskId);
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await deleteEventTask(taskId);
    } catch {
      setTasks((prev) => [...prev, removed].sort((a, b) => a.position - b.position));
    }
  };

  const updateTaskTime = async (task, scheduledTime) => {
    const oldTask = task;
    const updated = { ...task, scheduled_time: scheduledTime || null };
    setTasks((prev) => prev.map((t) => t.id === task.id ? updated : t));
    try {
      await updateEventTask(task.id, { scheduled_time: scheduledTime || null });
    } catch {
      setTasks((prev) => prev.map((t) => t.id === task.id ? oldTask : t));
    }
  };

  // ── Session completion ────────────────────────────────────────────────────
  const toggleCompleted = async () => {
    const next = !completed;
    setCompleted(next);
    try {
      await onUpdateSession(detail.eventId, { status: next ? 'completed' : 'planned' });
    } catch {
      setCompleted(!next);
    }
  };

  // ── Save / delete ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setActionError('');
    try {
      if (isExam) {
        const origDateISO = fmtDateISO(detail.date);
        const hasChanges =
          localDate !== origDateISO ||
          localTime !== (detail.time || '') ||
          localRoom !== (detail.room || '');
        if (hasChanges) {
          await onSaveExamDate(detail.examId, detail.componentName, origDateISO,
            { date: new Date(localDate + 'T00:00:00'), time: localTime, room: localRoom });
        }
      } else if (isSession) {
        const patch = {};
        if (localTitle.trim() !== (detail.title || detail.examName || '')) {
          patch.title = localTitle.trim() || detail.examName || null;
        }
        if (localNotes !== (detail.notes || '')) patch.notes = localNotes;

        if (sessionDate && sessionStartTime && sessionEndTime) {
          const newStart = new Date(`${sessionDate}T${sessionStartTime}:00`);
          const newEnd = new Date(`${sessionDate}T${sessionEndTime}:00`);
          if (newEnd <= newStart) {
            setSessionTimeError('L’orario di fine deve essere successivo all’orario di inizio.');
            return;
          }
          if (
            !sessionStart || !sessionEnd ||
            newStart.getTime() !== sessionStart.getTime() ||
            newEnd.getTime() !== sessionEnd.getTime()
          ) {
            patch.start_time = newStart.toISOString();
            patch.end_time = newEnd.toISOString();
          }
        }
        if (Object.keys(patch).length > 0) await onUpdateSession(detail.eventId, patch);
      }
      onClose();
    } catch (error) {
      setActionError(error.message || 'Impossibile salvare le modifiche.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    setActionError('');
    try {
      const deleted = await onDeleteSession(detail.eventId);
      if (deleted === false) throw new Error('Impossibile eliminare la sessione.');
      onClose();
    } catch (error) {
      setActionError(error.message || 'Impossibile eliminare la sessione.');
      setConfirmDelete(false);
    } finally {
      setSaving(false);
    }
  };

  const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  // ── Derived display ───────────────────────────────────────────────────────
  const title = isExam ? detail.examName : (detail.title || detail.examName);
  const subtitle = isExam
    ? detail.componentName
    : [
        detail.title && detail.title !== detail.examName ? detail.examName : null,
        detail.startTime && detail.endTime ? `${detail.startTime} – ${detail.endTime}` : 'Sessione di studio',
      ].filter(Boolean).join(' · ');

  const doneCount = tasks.filter((t) => t.completed).length;

  return (
    <div className="modal-backdrop" onClick={closeOnBackdrop}>
      <div ref={dialogRef} className="modal modal--compact event-detail" role="dialog" aria-modal="true" aria-labelledby="event-detail-title">

        {/* Header */}
        <div className="modal-hd">
          <div>
            <h2 id="event-detail-title" style={{ margin: 0 }}>{title}</h2>
            {subtitle && <div className="sub" style={{ marginTop: 2 }}>{subtitle}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">✕</button>
        </div>

        <div className="modal-body">

          {/* ── Sessione: stato completamento ── */}
          {isSession && (
            <button
              className={`session-complete-toggle ${completed ? 'is-done' : ''}`}
              onClick={toggleCompleted}
            >
              <span className="scc-check" aria-hidden="true">
                {completed && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </span>
              <span className="scc-label">
                {completed ? 'Sessione completata' : 'Segna come completata'}
              </span>
            </button>
          )}

          {/* ── Dettagli esame ── */}
          {isExam && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                <label className="field-label">Data</label>
                <input className="input" type="date" value={localDate}
                  onChange={(e) => setLocalDate(e.target.value)} disabled={detail.locked} />
                {detail.locked && <div className="field-hint">🔒 Data bloccata — non modificabile</div>}
              </div>
              <div className="field">
                <label className="field-label">Ora</label>
                <input className="input" type="time" value={localTime}
                  onChange={(e) => setLocalTime(e.target.value)} placeholder="es. 09:30" />
              </div>
              <div className="field">
                <label className="field-label">Aula / Sede</label>
                <input className="input" type="text" value={localRoom}
                  onChange={(e) => setLocalRoom(e.target.value)} placeholder="es. Aula 3" />
              </div>
            </div>
          )}

          {/* ── Sessione: note ── */}
          {isSession && (
            <div className="session-edit-fields">
              <div className="field">
                <label className="field-label">Titolo</label>
                <input
                  className="input"
                  value={localTitle}
                  onChange={(e) => setLocalTitle(e.target.value)}
                  placeholder={detail.examName || 'Sessione di studio'}
                />
              </div>
              <div className="field">
                <label className="field-label">Data sessione</label>
                <input className="input" type="date" value={sessionDate}
                  onChange={(e) => { setSessionDate(e.target.value); setSessionTimeError(''); }} />
              </div>
              <div className="session-time-grid">
                <div className="field">
                  <label className="field-label">Inizio</label>
                  <input className="input" type="time" value={sessionStartTime}
                    onChange={(e) => { setSessionStartTime(e.target.value); setSessionTimeError(''); }} />
                </div>
                <div className="field">
                  <label className="field-label">Fine</label>
                  <input className="input" type="time" value={sessionEndTime}
                    onChange={(e) => { setSessionEndTime(e.target.value); setSessionTimeError(''); }} />
                </div>
              </div>
              {sessionTimeError && <div className="session-time-error">{sessionTimeError}</div>}
              <div className="field">
                <label className="field-label">Note</label>
                <textarea className="input" value={localNotes}
                  onChange={(e) => setLocalNotes(e.target.value)}
                  placeholder="Cosa studiare in questa sessione…" rows={2}
                  style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              </div>
            </div>
          )}

          {actionError && <div className="ai-error" role="alert">{actionError}</div>}

          {/* ── Task list ── */}
          <div className="field task-block">
            <div className="task-block-hd">
              <label className="field-label" style={{ margin: 0 }}>Task</label>
              {tasks.length > 0 && (
                <span className="task-count">{doneCount}/{tasks.length}</span>
              )}
            </div>

            {loadingTasks ? (
              <div className="task-loading">Caricamento…</div>
            ) : tasks.length === 0 ? (
              <div className="task-empty">Nessun task. Aggiungine uno qui sotto.</div>
            ) : (
              <ul className="task-list">
                {tasks.map((task) => (
                  <li key={task.id} className={`task-row ${task.completed ? 'is-done' : ''}`}>
                    <button
                      className="task-check"
                      onClick={() => toggleTask(task)}
                      aria-label={task.completed ? 'Segna da fare' : 'Segna completato'}
                    >
                      {task.completed && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </button>

                    {editingId === task.id ? (
                      <input
                        className="task-edit-input"
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onBlur={() => saveEdit(task.id)}
                        onKeyDown={(e) => e.key === 'Enter' && saveEdit(task.id)}
                        autoFocus
                      />
                    ) : (
                      <span className="task-text" onDoubleClick={() => startEdit(task)}>
                        {task.text}
                      </span>
                    )}

                    <input
                      className="task-time-input"
                      type="time"
                      value={task.scheduled_time ? String(task.scheduled_time).slice(0, 5) : ''}
                      onChange={(e) => updateTaskTime(task, e.target.value)}
                      aria-label={`Orario task ${task.text}`}
                      title="Orario del task"
                    />

                    <button className="task-del" onClick={() => removeTask(task.id)} title="Elimina" aria-label="Elimina task">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="task-add">
              <input
                className="task-new-time"
                type="time"
                value={newTaskTime}
                onChange={(e) => setNewTaskTime(e.target.value)}
                aria-label="Orario nuovo task"
              />
              <input
                className="task-add-input"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                placeholder="Nuovo task…"
              />
              <button className="task-add-btn" onClick={addTask} disabled={!newTaskText.trim()} aria-label="Aggiungi task">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="modal-ft">
          {isExam && (
            <button className="btn ghost" onClick={() => onOpenFullEditor(detail.examId)} style={{ marginRight: 'auto' }}>
              Apri editor completo
            </button>
          )}
          {isSession && !confirmDelete && (
            <button className="btn ghost danger" onClick={() => setConfirmDelete(true)} style={{ marginRight: 'auto' }}>
              Elimina sessione
            </button>
          )}
          {isSession && confirmDelete && (
            <div className="delete-confirm-row" style={{ marginRight: 'auto' }}>
              <span className="delete-confirm-text">Eliminare?</span>
              <button className="btn danger" style={{ padding: '5px 10px', fontSize: 12 }} onClick={handleDelete} disabled={saving}>
                {saving ? 'Eliminazione…' : 'Sì'}
              </button>
              <button className="btn ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => setConfirmDelete(false)}>No</button>
            </div>
          )}
          <button className="btn ghost" onClick={onClose}>Chiudi</button>
          <button className="btn" onClick={handleSave} disabled={saving}>
            {saving ? 'Salvataggio…' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}
