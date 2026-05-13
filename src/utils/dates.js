export const MONTHS_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];

export const WEEKDAYS_IT = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function diffDays(from, to) {
  return Math.round((startOfDay(to) - startOfDay(from)) / 86400000);
}

export function formatDueLabel(date, today) {
  const days = diffDays(today, date);
  if (days < 0) return { text: `${-days}g fa`, urgent: false };
  if (days === 0) return { text: 'oggi', urgent: true };
  if (days === 1) return { text: 'domani', urgent: true };
  if (days <= 7) return { text: `tra ${days} giorni`, urgent: true };
  return { text: `tra ${days} giorni`, urgent: false };
}

export function formatLongDate(date) {
  return `${date.getDate()} ${MONTHS_IT[date.getMonth()].toLowerCase()}`;
}

export function monthGrid(year, month) {
  const dow = (new Date(year, month, 1).getDay() + 6) % 7;
  const start = new Date(year, month, 1 - dow);
  return Array.from({ length: 42 }, (_, i) => {
    const dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      date: dt,
      inMonth: dt.getMonth() === month,
      weekend: dt.getDay() === 0 || dt.getDay() === 6,
    };
  });
}

export function loadScore(effort, difficulty) {
  const score = (effort + difficulty) / 2;
  if (score <= 3)   return { level: 'low',  label: 'Basso' };
  if (score <= 5.5) return { level: 'med',  label: 'Medio' };
  if (score <= 7.5) return { level: 'high', label: 'Alto' };
  return             { level: 'crit', label: 'Critico' };
}

export function statusLabel(s) {
  return {
    todo: 'Da iniziare',
    active: 'In corso',
    partial: 'Parziale',
    done: 'Completato',
    failed: 'Non superato',
    saltato: 'Saltato',
  }[s] || s;
}
