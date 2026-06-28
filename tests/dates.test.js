import test from 'node:test';
import assert from 'node:assert/strict';
import { diffDays, monthGrid, sameDay } from '../src/utils/dates.js';

test('diffDays ignores the current time', () => {
  assert.equal(
    diffDays(new Date(2026, 5, 28, 23, 55), new Date(2026, 5, 29, 0, 5)),
    1
  );
});

test('monthGrid always produces six complete weeks', () => {
  const cells = monthGrid(2026, 5);
  assert.equal(cells.length, 42);
  assert.equal(cells[0].date.getDay(), 1);
  assert.equal(cells[41].date.getDay(), 0);
});

test('sameDay compares calendar dates, not timestamps', () => {
  assert.equal(
    sameDay(new Date(2026, 5, 28, 8), new Date(2026, 5, 28, 22)),
    true
  );
});
