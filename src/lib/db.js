import { supabase } from './supabase.js';

// ── Serialization ────────────────────────────────────────────────────────────

function serializeExam(exam) {
  return JSON.parse(JSON.stringify(exam));
}

function reviveExam(data) {
  return JSON.parse(JSON.stringify(data), (key, val) => {
    if (key === 'date' && typeof val === 'string' && val) return new Date(val);
    return val;
  });
}

function reviveWindows(rows) {
  return rows.map((r) => {
    const raw = r.label || '';
    // Encoded format: "HH:MM-HH:MM|label text"
    const m = raw.match(/^(\d{2}:\d{2})-(\d{2}:\d{2})\|(.*)$/);
    return {
      id: r.id,
      examId: r.exam_id,
      start: new Date(r.start_date + 'T00:00:00'),
      end: new Date(r.end_date + 'T00:00:00'),
      startTime: m ? m[1] : null,
      endTime:   m ? m[2] : null,
      label: m ? m[3] : raw,
      completed: r.completed || false,
    };
  });
}

function fmtDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// ── User preferences / onboarding ───────────────────────────────────────────

export async function fetchOnboardingCompleted(userId) {
  const { data, error } = await supabase
    .from('user_preferences')
    .select('onboarding_completed')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  if (!data) {
    const { error: insertError } = await supabase
      .from('user_preferences')
      .insert({ user_id: userId, onboarding_completed: false });
    if (insertError) throw insertError;
    return false;
  }

  return !!data.onboarding_completed;
}

export async function completeOnboarding(userId) {
  const { error } = await supabase
    .from('user_preferences')
    .upsert({
      user_id: userId,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ── Exams ────────────────────────────────────────────────────────────────────

export async function fetchExams() {
  const { data, error } = await supabase
    .from('exams')
    .select('id, data')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, ...reviveExam(row.data) }));
}

export async function upsertExam(exam, _userId, taskMoves = []) {
  const { id, ...rest } = exam;
  const { error } = await supabase.rpc('save_exam', {
    p_exam_id: id,
    p_exam_data: serializeExam(rest),
    p_task_moves: taskMoves,
  });
  if (error) throw error;
}

export async function deleteExamData(examId) {
  const { error } = await supabase.rpc('delete_exam_data', { p_exam_id: examId });
  if (error) throw error;
}

// ── Study windows ────────────────────────────────────────────────────────────

export async function fetchStudyWindows() {
  const { data, error } = await supabase
    .from('study_windows')
    .select('id, exam_id, start_date, end_date, label, completed')
    .order('start_date', { ascending: true });
  if (error) throw error;
  return reviveWindows(data);
}

export async function updateStudyWindowComplete(windowId, completed) {
  const { error } = await supabase
    .from('study_windows')
    .update({ completed })
    .eq('id', windowId);
  if (error) throw error;
}

// ── Date picks ───────────────────────────────────────────────────────────────

export async function fetchDatePicks() {
  const { data, error } = await supabase
    .from('exam_date_picks')
    .select('exam_id, component_name, pick_date');
  if (error) throw error;
  return data.map((r) => ({
    examId: r.exam_id,
    componentName: r.component_name,
    date: new Date(r.pick_date + 'T00:00:00'),
  }));
}

export async function clearPlan() {
  const { error } = await supabase.rpc('clear_ai_plan');
  if (error) throw error;
}

// ── Events ───────────────────────────────────────────────────────────────────

function daysInRange(startStr, endStr) {
  const days = [];
  const cur = new Date(startStr + 'T00:00:00');
  const last = new Date(endStr + 'T00:00:00');
  while (cur <= last) {
    days.push(fmtDate(new Date(cur)));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

const SLOT_DEFS = [
  { key: 'morning',   start: '09:00', end: '12:00' },
  { key: 'afternoon', start: '14:00', end: '18:00' },
  { key: 'evening',   start: '19:00', end: '22:00' },
];

function buildSlots(studyPrefs) {
  if (!studyPrefs) return [SLOT_DEFS[0]];
  // New schema: studySlots array
  if (studyPrefs.studySlots) {
    const active = studyPrefs.studySlots
      .filter((s) => s.enabled)
      .map((s) => ({ key: 'custom', start: s.start, end: s.end }));
    return active.length > 0 ? active : [SLOT_DEFS[0]];
  }
  // Legacy schema: morning/afternoon/evening booleans
  const active = SLOT_DEFS.filter((s) => studyPrefs[s.key]);
  return active.length > 0 ? active : [SLOT_DEFS[0]];
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(total) {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// Per ogni giorno attivo (mai prima di oggi) crea UNA sessione per ogni fascia
// oraria abilitata: così un esame può avere mattina + pomeriggio + sera. Gli esami
// attivi nello stesso giorno sono distribuiti round-robin sulle fasce, dando priorità
// a chi ha la scadenza più vicina. Nessuna descrizione automatica: notes resta vuoto,
// il titolo è solo il nome dell'esame — l'utente personalizza il contenuto.
//
// studyWindows: formato grezzo Groq { examId, start:"YYYY-MM-DD", end:"YYYY-MM-DD", ... }
// exams: array di esami (per risolvere nomi e scadenze)
// studyPrefs: { studySlots?, studyDays?, morning?, afternoon?, evening? }
export async function buildStudyEvents(studyWindows, exams, studyPrefs, providedUserId = null) {
  if (!studyWindows.length) return [];

  let userId = providedUserId;
  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id;
  }
  if (!userId) throw new Error('Non autenticato');

  const slots      = buildSlots(studyPrefs);
  const studyDays  = studyPrefs?.studyDays ?? null; // null = tutti i giorni
  const examById   = new Map(exams.map((e) => [e.id, e]));
  const todayStr   = fmtDate(new Date());
  const deadlineByExam = new Map(
    studyWindows
      .filter((window) => window.deadline)
      .map((window) => [
        window.examId,
        new Date(`${window.deadline}T00:00:00`).getTime(),
      ])
  );

  // Scadenza dell'esame = data più vicina tra tutte le componenti
  function examDeadline(examId) {
    if (deadlineByExam.has(examId)) return deadlineByExam.get(examId);
    const exam = examById.get(examId);
    if (!exam) return Infinity;
    const times = exam.components
      .flatMap((component) => component.dates
        .filter((date) => date.date && date.preference !== 'excluded')
        .map((date) => date.date)
      )
      .filter((date) => {
        const value = date instanceof Date ? date : new Date(`${date}T00:00:00`);
        return value >= new Date(`${todayStr}T00:00:00`);
      })
      .map((d) => (d instanceof Date ? d.getTime() : new Date(d + 'T00:00:00').getTime()));
    return times.length ? Math.min(...times) : Infinity;
  }
  const examEffort = (examId) => {
    const exam = examById.get(examId);
    const remainingHours = Number(exam?.remainingHours || 0);
    if (remainingHours > 0) return Math.min(10, Math.max(1, remainingHours / 10));
    return exam?.effort ?? 5;
  };

  const slotPeriod = (start) => {
    const hour = Number(start.split(':')[0]);
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    return 'evening';
  };

  // Normalizza le date delle windows a stringhe YYYY-MM-DD
  const wins = studyWindows.map((w) => ({
    ...w,
    startStr: typeof w.start === 'string' ? w.start : fmtDate(w.start),
    endStr:   typeof w.end   === 'string' ? w.end   : fmtDate(w.end),
  }));

  // Range globale, mai prima di oggi: nessuna sessione nel passato
  let globalStart = wins.reduce((m, w) => (w.startStr < m ? w.startStr : m), wins[0].startStr);
  const globalEnd = wins.reduce((m, w) => (w.endStr   > m ? w.endStr   : m), wins[0].endStr);
  if (globalStart < todayStr) globalStart = todayStr;
  if (globalEnd < todayStr) return []; // tutto il piano è nel passato
  const allDays = daysInRange(globalStart, globalEnd);

  const rows = [];

  for (const day of allDays) {
    if (day < todayStr) continue;
    // Salta giorni non inclusi nelle preferenze utente
    if (studyDays) {
      const dayOfWeek = new Date(day + 'T00:00:00').getDay();
      if (!studyDays.includes(dayOfWeek)) continue;
    }

    // Esami attivi questo giorno, ordinati per urgenza (scadenza, poi effort)
    const active = wins
      .filter((w) => day >= w.startStr && day <= w.endStr)
      .sort((a, b) =>
        (examDeadline(a.examId) - examDeadline(b.examId)) ||
        (examEffort(b.examId) - examEffort(a.examId))
      );
    if (!active.length) continue;

    // Una sessione per ogni fascia abilitata. Se le fasce sono più degli esami,
    // i blocchi extra vanno all'esame più urgente/difficile.
    const manualAssignments = studyPrefs?.slotAssignments || studyPrefs?.slot_assignments || [];
    const allocation = slots.map((slot, index) => {
      const assignedExamId = manualAssignments[index];
      const manuallyAssigned = active.find((window) => window.examId === assignedExamId);
      if (manuallyAssigned) return manuallyAssigned;
      const period = slotPeriod(slot.start);
      const preferred = active.filter((window) => {
        const preference = examById.get(window.examId)?.preferredTime || 'any';
        return preference === 'any' || preference === period;
      });
      const pool = preferred.length ? preferred : active;
      if (pool.length === 1) return pool[0];
      return pool[index % pool.length];
    });

    slots.forEach((slot, bi) => {
      const w        = allocation[bi];
      if (!w) return;
      const exam     = examById.get(w.examId);
      const startMin = timeToMin(slot.start);
      // La fascia scelta dall'utente coincide con la sessione: 09:00–12:00
      // genera un unico evento di tre ore, senza tagli automatici.
      const endMin   = timeToMin(slot.end);
      if (endMin <= startMin) return;

      const studyStart = new Date(`${day}T${minToTime(startMin)}:00`);
      const studyEnd   = new Date(`${day}T${minToTime(endMin)}:00`);

      rows.push({
        user_id:    userId,
        exam_id:    w.examId,
        type:       'study',
        title:      exam?.name ?? 'Studio',
        start_time: studyStart.toISOString(),
        end_time:   studyEnd.toISOString(),
        status:     'planned',
        notes:      null,
        origin:     'ai',
      });
    });
  }

  return rows;
}

// Ritorna tutte le sessioni di studio dell'utente (una riga per sessione).
// Le pause ('break') non sono incluse: non sono sessioni cliccabili.
export async function fetchEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, exam_id, type, title, start_time, end_time, status, notes, origin')
    .eq('type', 'study')
    .order('start_time', { ascending: true });
  if (error) throw error;
  return data;
}

// Crea sessioni di studio indipendenti per un esame su un intervallo di prep.
// Ogni sessione è una riga `events` separata, con id e orario propri.
// All'interno di ogni giorno attivo riempie la fascia [startTime, endTime] con
// sessioni di `sessionMinutes` separate da `breakMinutes`.
export async function createManualSessions({
  examId, startStr, endStr, startTime, endTime,
  sessionMinutes, breakMinutes, studyDays, title, notes,
}) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  const days = daysInRange(startStr, endStr);
  const slotStart = timeToMin(startTime);
  const slotEnd   = timeToMin(endTime);
  const rows = [];

  for (const day of days) {
    if (studyDays && studyDays.length) {
      const dow = new Date(day + 'T00:00:00').getDay();
      if (!studyDays.includes(dow)) continue;
    }

    let cur = slotStart;
    let made = 0;
    while (cur + sessionMinutes <= slotEnd) {
      const s = new Date(`${day}T${minToTime(cur)}:00`);
      const e = new Date(`${day}T${minToTime(cur + sessionMinutes)}:00`);
      rows.push({
        user_id: user.id, exam_id: examId, type: 'study',
        title: title || null,
        start_time: s.toISOString(), end_time: e.toISOString(),
        status: 'planned', notes: notes || null, origin: 'manual',
      });
      cur += sessionMinutes + breakMinutes;
      made++;
    }
    // Garantisce almeno una sessione nel giorno attivo se l'intervallo è corto
    if (made === 0 && slotStart < slotEnd) {
      const s = new Date(`${day}T${minToTime(slotStart)}:00`);
      const e = new Date(`${day}T${minToTime(slotEnd)}:00`);
      rows.push({
        user_id: user.id, exam_id: examId, type: 'study',
        title: title || null,
        start_time: s.toISOString(), end_time: e.toISOString(),
        status: 'planned', notes: notes || null, origin: 'manual',
      });
    }
  }

  if (!rows.length) return [];
  const { data, error } = await supabase.from('events').insert(rows).select();
  if (error) throw error;
  return data;
}

// Aggiorna una singola sessione (status / notes / title) — nessun'altra toccata.
export async function updateEvent(eventId, patch) {
  const updates = {};
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.notes  !== undefined) updates.notes  = patch.notes;
  if (patch.title  !== undefined) updates.title  = patch.title;
  if (patch.start_time !== undefined) updates.start_time = patch.start_time;
  if (patch.end_time   !== undefined) updates.end_time   = patch.end_time;

  const { error } = await supabase.from('events').update(updates).eq('id', eventId);
  if (error) throw error;
}

export async function replacePlanAtomically(picks, windows, eventRows) {
  const windowPayload = windows.map((window) => ({
    examId: window.examId,
    start: fmtDate(window.start),
    end: fmtDate(window.end),
    label: window.startTime && window.endTime
      ? `${window.startTime}-${window.endTime}|${window.label || ''}`
      : (window.label || ''),
  }));
  const eventPayload = eventRows.map((event) => ({
    exam_id: event.exam_id,
    type: event.type,
    title: event.title,
    start_time: event.start_time,
    end_time: event.end_time,
    status: event.status,
    notes: event.notes,
  }));

  const { error } = await supabase.rpc('replace_ai_plan', {
    p_picks: picks,
    p_windows: windowPayload,
    p_events: eventPayload,
  });
  if (error) throw error;
}

// Cancella SOLO quell'evento specifico — nessun altro evento viene toccato.
export async function deleteEvent(eventId) {
  const { error } = await supabase
    .from('events')
    .delete()
    .eq('id', eventId);
  if (error) throw error;
}

// ── Event tasks (todo list per eventi e blocchi studio) ──────────────────────

export async function fetchEventTasks(refKey) {
  const { data, error } = await supabase
    .from('event_tasks')
    .select('id, ref_key, text, completed, position, scheduled_time')
    .eq('ref_key', refKey)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createEventTask(refKey, text, userId, scheduledTime = null) {
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id;
  }
  if (!uid) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('event_tasks')
    .insert({
      user_id: uid, ref_key: refKey, text, completed: false, position: 0,
      scheduled_time: scheduledTime || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Task legati a una singola sessione (events.id) — non si propagano fra giorni.
export async function fetchTasksForEvent(eventId) {
  const { data, error } = await supabase
    .from('event_tasks')
    .select('id, event_id, text, completed, position, scheduled_time')
    .eq('event_id', eventId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function createSessionTask(eventId, text, userId, scheduledTime = null) {
  let uid = userId;
  if (!uid) {
    const { data: { user } } = await supabase.auth.getUser();
    uid = user?.id;
  }
  if (!uid) throw new Error('Non autenticato');

  const { data, error } = await supabase
    .from('event_tasks')
    .insert({
      user_id: uid, event_id: eventId, text, completed: false, position: 0,
      scheduled_time: scheduledTime || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEventTask(taskId, patch) {
  const updates = {};
  if (patch.text !== undefined)      updates.text = patch.text;
  if (patch.completed !== undefined) updates.completed = patch.completed;
  if (patch.position !== undefined)  updates.position = patch.position;
  if (patch.scheduled_time !== undefined) updates.scheduled_time = patch.scheduled_time || null;

  const { error } = await supabase
    .from('event_tasks')
    .update(updates)
    .eq('id', taskId);
  if (error) throw error;
}

export async function deleteEventTask(taskId) {
  const { error } = await supabase
    .from('event_tasks')
    .delete()
    .eq('id', taskId);
  if (error) throw error;
}

export async function updateExamDateAndTasks(exam, componentName, oldDate, newDate) {
  const { id, ...data } = exam;
  const oldRef = `exam:${id}:${componentName}:${oldDate}`;
  const newRef = `exam:${id}:${componentName}:${newDate}`;
  const { error } = await supabase.rpc('save_exam', {
    p_exam_id: id,
    p_exam_data: serializeExam(data),
    p_task_moves: [{
      oldRef,
      newRef,
      oldComponent: componentName,
      newComponent: componentName,
      oldDate,
      newDate,
    }],
  });
  if (error) throw error;
}
