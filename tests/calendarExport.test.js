import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateFilteredICS,
  getFilteredEvents,
} from '../src/utils/calendarExport.js';

const exams = [{
  id: 'exam-1',
  name: 'Analisi',
  difficulty: 8,
  effort: 7,
  notes: '',
  components: [{
    name: 'Scritto',
    dates: [
      { id: 'a', date: new Date(2026, 6, 1), time: '09:00', room: '', locked: false },
      { id: 'b', date: new Date(2026, 6, 20), time: '09:00', room: '', locked: false },
    ],
  }],
}];

const picks = [{
  examId: 'exam-1',
  componentName: 'Scritto',
  date: new Date(2026, 6, 20),
}];

test('calendar filtering respects the all-dates switch', () => {
  assert.equal(getFilteredEvents(exams, picks, false).length, 1);
  assert.equal(getFilteredEvents(exams, picks, true).length, 2);
});

test('ICS export includes study sessions', () => {
  const ics = generateFilteredICS(exams, picks, false, [{
    id: 'session-1',
    type: 'study',
    title: 'Studio Analisi',
    start_time: new Date(2026, 6, 10, 9).toISOString(),
    end_time: new Date(2026, 6, 10, 12).toISOString(),
    notes: '',
  }]);
  assert.match(ics, /SUMMARY:Studio Analisi/);
  assert.doesNotMatch(ics, /Sessione di studio pianificata/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2);
});
