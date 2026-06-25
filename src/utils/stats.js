import { supabase } from '../lib/supabase.js';

// Ore studiate per materia (solo eventi 'study' completati).
// Ritorna: [{ examId, name, totalMinutes, totalHours }]
export async function getStudyHoursByExam(userId) {
  const { data, error } = await supabase
    .from('events')
    .select('exam_id, duration_min, exams(data)')
    .eq('user_id', userId)
    .eq('type', 'study')
    .eq('status', 'completed')
    .not('exam_id', 'is', null);
  if (error) throw error;

  const byExam = new Map();
  for (const row of data) {
    const key = row.exam_id;
    if (!byExam.has(key)) {
      byExam.set(key, {
        examId: key,
        name: row.exams?.data?.name ?? key,
        totalMinutes: 0,
      });
    }
    byExam.get(key).totalMinutes += row.duration_min ?? 0;
  }

  return Array.from(byExam.values()).map((e) => ({
    ...e,
    totalHours: +(e.totalMinutes / 60).toFixed(1),
  }));
}

// Progressione del piano: quante sessioni di studio sono planned / completed / skipped.
// Ritorna: { planned: number, completed: number, skipped: number }
export async function getPlanProgress(userId) {
  const { data, error } = await supabase
    .from('events')
    .select('status')
    .eq('user_id', userId)
    .eq('type', 'study');
  if (error) throw error;

  const counts = { planned: 0, completed: 0, skipped: 0 };
  for (const row of data) {
    if (row.status in counts) counts[row.status]++;
  }
  return counts;
}
