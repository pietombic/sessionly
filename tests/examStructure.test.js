import test from 'node:test';
import assert from 'node:assert/strict';
import {
  componentNeedsPlanning,
  deriveLegacyExamType,
  normalizeExamComponents,
  selectedProofs,
} from '../src/utils/examStructure.js';

test('a new exam can normalize an empty component list', () => {
  assert.deepEqual(normalizeExamComponents([], null), []);
});

test('legacy completed first partial is preserved in the new component model', () => {
  const components = normalizeExamComponents([
    { name: 'Parziale 2', dates: [] },
    { name: 'Orale', dates: [] },
  ], {
    partial1Done: true,
    partial1Grade: 27,
  });

  assert.equal(components[0].name, 'Parziale 1');
  assert.equal(components[0].status, 'completed');
  assert.equal(components[0].grade, 27);
  assert.equal(deriveLegacyExamType(components), 'parziali-orale');
});

test('partials select the written proof and completed ones are not planned', () => {
  const components = normalizeExamComponents([
    { name: 'Parziale 1', status: 'completed', dates: [] },
    { name: 'Parziale 2', status: 'pending', dates: [] },
    { name: 'Progetto', dates: [] },
  ]);

  assert.deepEqual([...selectedProofs(components)].sort(), ['project', 'written']);
  assert.equal(componentNeedsPlanning(components[0]), false);
  assert.equal(componentNeedsPlanning(components[1]), true);
});

test('a failed partial remains part of the next plan', () => {
  assert.equal(componentNeedsPlanning({ status: 'failed', required: true }), true);
});
