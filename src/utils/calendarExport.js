import { MONTHS_IT } from './dates.js';

function pad(n) {
  return String(n).padStart(2, '0');
}

function icsDate(date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function icsDateTime(date, time) {
  if (!time) return icsDate(date);
  const [h, m] = time.split(':');
  return `${icsDate(date)}T${pad(Number(h))}${pad(Number(m))}00`;
}

function icsDateTimeEnd(date, time) {
  if (!time) {
    const next = new Date(date.getTime() + 86400000);
    return icsDate(next);
  }
  const [h, m] = time.split(':');
  const endH = Number(h) + 2;
  return `${icsDate(date)}T${pad(endH)}${pad(Number(m))}00`;
}

function escapeICS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateICS(exams) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sessionly//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];

  for (const exam of exams) {
    for (const comp of exam.components) {
      for (const dt of comp.dates) {
        if (!dt.date) continue;

        const uid = `${exam.id}-${comp.name.replace(/\s/g, '')}-${dt.id}@sessionly`;
        const hasTime = !!dt.time;
        const dtStart = icsDateTime(dt.date, dt.time);
        const dtEnd = icsDateTimeEnd(dt.date, dt.time);
        const summary = escapeICS(`${exam.name} — ${comp.name}${dt.locked ? ' 🔒' : ''}`);
        const description = escapeICS(
          `${exam.name} · ${comp.name}\nPriorità: ${exam.priority}\nDifficoltà: ${exam.difficulty}/10\nEffort: ${exam.effort}/10${exam.notes ? '\n\n' + exam.notes : ''}`
        );

        lines.push(
          'BEGIN:VEVENT',
          `UID:${uid}`,
          `SUMMARY:${summary}`,
          hasTime ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
          hasTime ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
          dt.room ? `LOCATION:${escapeICS(dt.room)}` : '',
          `DESCRIPTION:${description}`,
          'END:VEVENT',
        ).filter(Boolean);
      }
    }
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(exams) {
  const content = generateICS(exams);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'sessionly.ics';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function googleCalendarURL(exam, comp, dt) {
  if (!dt.date) return null;

  const fmt = (date, time) => {
    const base = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
    if (!time) return base;
    const [h, m] = time.split(':');
    return `${base}T${pad(Number(h))}${pad(Number(m))}00`;
  };

  const fmtEnd = (date, time) => {
    if (!time) {
      const next = new Date(date.getTime() + 86400000);
      return `${next.getFullYear()}${pad(next.getMonth() + 1)}${pad(next.getDate())}`;
    }
    const [h, m] = time.split(':');
    return `${icsDate(date)}T${pad(Number(h) + 2)}${pad(Number(m))}00`;
  };

  const start = fmt(dt.date, dt.time);
  const end = fmtEnd(dt.date, dt.time);

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${exam.name} — ${comp.name}${dt.locked ? ' 🔒' : ''}`,
    dates: `${start}/${end}`,
    details: `Priorità: ${exam.priority}\nDifficoltà: ${exam.difficulty}/10\nEffort: ${exam.effort}/10${exam.notes ? '\n\n' + exam.notes : ''}`,
    ...(dt.room ? { location: dt.room } : {}),
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getAllEvents(exams) {
  const events = [];
  for (const exam of exams) {
    for (const comp of exam.components) {
      for (const dt of comp.dates) {
        if (!dt.date) continue;
        events.push({ exam, comp, dt });
      }
    }
  }
  return events.sort((a, b) => a.dt.date - b.dt.date);
}

export function formatShortDate(date) {
  return `${date.getDate()} ${MONTHS_IT[date.getMonth()].slice(0, 3).toLowerCase()}`;
}
