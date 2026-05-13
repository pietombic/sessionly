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

// ── Exams ────────────────────────────────────────────────────────────────────

export async function fetchExams() {
  const { data, error } = await supabase
    .from('exams')
    .select('id, data')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data.map((row) => ({ id: row.id, ...reviveExam(row.data) }));
}

export async function upsertExam(exam, userId) {
  const { id, ...rest } = exam;
  const { error } = await supabase
    .from('exams')
    .upsert(
      { id, user_id: userId, data: serializeExam(rest), updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) throw error;
}

export async function removeExam(examId) {
  const { error } = await supabase.from('exams').delete().eq('id', examId);
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

export async function replaceStudyWindows(windows) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  await supabase.from('study_windows').delete().eq('user_id', user.id);

  if (windows.length === 0) return;

  const rows = windows.map((w) => ({
    user_id: user.id,
    exam_id: w.examId,
    start_date: fmtDate(w.start),
    end_date: fmtDate(w.end),
    label: w.startTime && w.endTime
      ? `${w.startTime}-${w.endTime}|${w.label}`
      : w.label,
    completed: false,
  }));

  const { error } = await supabase.from('study_windows').insert(rows);
  if (error) throw error;
}

export async function removeStudyWindowsForExam(examId) {
  const { error } = await supabase.from('study_windows').delete().eq('exam_id', examId);
  if (error) throw error;
}

export async function removeStudyWindow(windowId) {
  const { error } = await supabase.from('study_windows').delete().eq('id', windowId);
  if (error) throw error;
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

export async function replaceDatePicks(picks) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  await supabase.from('exam_date_picks').delete().eq('user_id', user.id);

  if (picks.length === 0) return;

  const rows = picks.map((p) => ({
    user_id: user.id,
    exam_id: p.examId,
    component_name: p.componentName,
    pick_date: p.date,
  }));

  const { error } = await supabase.from('exam_date_picks').insert(rows);
  if (error) throw error;
}

export async function removeDatePicksForExam(examId) {
  const { error } = await supabase.from('exam_date_picks').delete().eq('exam_id', examId);
  if (error) throw error;
}

export async function clearPlan() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  await Promise.all([
    supabase.from('exam_date_picks').delete().eq('user_id', user.id),
    supabase.from('study_windows').delete().eq('user_id', user.id),
  ]);
}
