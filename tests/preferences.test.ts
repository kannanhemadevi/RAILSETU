import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeJourneyPreferences, resolveJourneyPreferences } from '../src/engine/preferences.ts'

test('all-zero slider values resolve to balanced finite weights', () => {
  const resolved = resolveJourneyPreferences({ reliability: 0, comfort: 0, speed: 0 })
  assert.deepEqual(resolved, { reliability: 1, comfort: 1, speed: 1 })
  const normalized = normalizeJourneyPreferences({ reliability: 0, comfort: 0, speed: 0 })
  assert.ok(Object.values(normalized).every(Number.isFinite))
  assert.ok(Object.values(normalized).every((value) => Math.abs(value - 100 / 3) < 1e-9))
})

test('negative or non-finite slider values use balanced safe weights', () => {
  assert.deepEqual(resolveJourneyPreferences({ reliability: -1, comfort: 20, speed: Number.NaN }), { reliability: 1, comfort: 1, speed: 1 })
})
