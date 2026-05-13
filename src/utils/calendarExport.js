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
  // Clamp to 23:59 if overflow
  if (endH >= 24) return `${icsDate(date)}T235900`;
  return `${icsDate(date)}T${pad(endH)}${pad(Number(m))}00`;
}

function icsNow() {
  const n = new Date();
  return `${n.getUTCFullYear()}${pad(n.getUTCMonth()+1)}${pad(n.getUTCDate())}T${pad(n.getUTCHours())}${pad(n.getUTCMinutes())}${pad(n.getUTCSeconds())}Z`;
}

function escapeICS(str) {
  return String(str || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// RFC 5545 §3.1 — fold lines longer than 75 octets
function fold(line) {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  let result = '';
  let buf = '';
  for (const ch of line) {
    const next = buf + ch;
    if (enc.encode(next).length > (result === '' ? 75 : 74)) {
      result += (result === '' ? '' : '\r\n ') + buf;
      buf = ch;
    } else {
      buf = next;
    }
  }
  if (buf) result += (result === '' ? '' : '\r\n ') + buf;
  return result;
}

function buildVEvent(exam, comp, dt, dtstamp) {
  const uid = `${exam.id}-${comp.name.replace(/\s/g, '')}-${dt.id || dt.date.getTime()}@sessionly`;
  const hasTime = !!dt.time;
  const dtStart = icsDateTime(dt.date, dt.time);
  const dtEnd = icsDateTimeEnd(dt.date, dt.time);
  const summary = escapeICS(`${exam.name} — ${comp.name}${dt.locked ? ' 🔒' : ''}`);
  const description = escapeICS(
    [
      `${exam.name} · ${comp.name}`,
      `Difficoltà: ${exam.difficulty}/10`,
      `Effort: ${exam.effort}/10`,
      exam.notes ? exam.notes : null,
    ].filter(Boolean).join('\\n')
  );

  const props = [
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `SUMMARY:${summary}`,
    hasTime ? `DTSTART:${dtStart}` : `DTSTART;VALUE=DATE:${dtStart}`,
    hasTime ? `DTEND:${dtEnd}` : `DTEND;VALUE=DATE:${dtEnd}`,
    dt.room ? `LOCATION:${escapeICS(dt.room)}` : null,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
  ].filter(Boolean);

  return props;
}

function buildICS(events) {
  const dtstamp = icsNow();
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Sessionly//IT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Sessionly',
  ];

  for (const { exam, comp, dt } of events) {
    lines.push(...buildVEvent(exam, comp, dt, dtstamp));
  }

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateICS(exams) {
  return buildICS(getAllEvents(exams));
}

export function downloadICS(exams) {
  triggerDownload(generateICS(exams), 'sessionly.ics');
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
    const endH = Math.min(Number(h) + 2, 23);
    return `${icsDate(date)}T${pad(endH)}${pad(Number(m))}00`;
  };

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `${exam.name} — ${comp.name}${dt.locked ? ' 🔒' : ''}`,
    dates: `${fmt(dt.date, dt.time)}/${fmtEnd(dt.date, dt.time)}`,
    details: [
      `Difficoltà: ${exam.difficulty}/10`,
      `Effort: ${exam.effort}/10`,
      exam.notes || '',
    ].filter(Boolean).join('\n'),
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

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function getFilteredEvents(exams, datePicks) {
  if (!datePicks || datePicks.length === 0) return getAllEvents(exams);
  return getAllEvents(exams).filter(({ exam, comp, dt }) =>
    datePicks.some(
      (p) => p.examId === exam.id && p.componentName === comp.name && sameDay(p.date, dt.date)
    )
  );
}

export function generateFilteredICS(exams, datePicks) {
  return buildICS(getFilteredEvents(exams, datePicks));
}

export function downloadFilteredICS(exams, datePicks) {
  triggerDownload(generateFilteredICS(exams, datePicks), 'sessionly.ics');
}

export function formatShortDate(date) {
  return `${date.getDate()} ${MONTHS_IT[date.getMonth()].slice(0, 3).toLowerCase()}`;
}
