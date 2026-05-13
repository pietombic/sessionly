import { supabase } from './supabase.js';

// ── Serialization ────────────────────────────────────────────────────────────
// Date objects → ISO strings for JSONB storage; revived on read.

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
  return rows.map((r) => ({
    examId: r.exam_id,
    start: new Date(r.start_date + 'T00:00:00'),
    end: new Date(r.end_date + 'T00:00:00'),
    label: r.label || '',
  }));
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

export async function upsertExam(exam) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');
  const { id, ...rest } = exam;
  const { error } = await supabase
    .from('exams')
    .upsert({ id, user_id: user.id, data: serializeExam(rest), updated_at: new Date().toISOString() });
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
    .select('exam_id, start_date, end_date, label')
    .order('start_date', { ascending: true });
  if (error) throw error;
  return reviveWindows(data);
}

export async function replaceStudyWindows(windows) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Non autenticato');

  // Delete all, then insert new ones in a single transaction-like sequence
  await supabase.from('study_windows').delete().eq('user_id', user.id);

  if (windows.length === 0) return;

  const rows = windows.map((w) => ({
    user_id: user.id,
    exam_id: w.examId,
    start_date: fmtDate(w.start),
    end_date: fmtDate(w.end),
    label: w.label,
  }));

  const { error } = await supabase.from('study_windows').insert(rows);
  if (error) throw error;
}

export async function removeStudyWindowsForExam(examId) {
  const { error } = await supabase.from('study_windows').delete().eq('exam_id', examId);
  if (error) throw error;
}
