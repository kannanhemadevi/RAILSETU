import assert from 'node:assert/strict'
import test from 'node:test'
import { createBaselineSimulation, hasValidAlternative, inject55MinuteDelay, resetSimulation } from '../src/engine/disruptionSimulator.ts'
import { rankItineraries } from '../src/engine/decisionEngine.ts'
import type { PassengerProfile } from '../src/types/decision.ts'

const passengers: PassengerProfile[] = [{ id: 'traveller-1', name: 'Demo traveller', category: 'adult' }]
const unrelatedLedger = [{ id: 'unrelated', itineraryId: 'past', passengerId: 'traveller-1', amountPaise: 8000, currency: 'INR', status: 'requested' as const, reason: 'Synthetic prior record', recordedAt: '2030-01-01T00:00:00.000Z', synthetic: true as const }]

test('injecting a 55-minute delay invalidates the tight transfer and reranks the direct alternative', () => {
  const baseline = createBaselineSimulation(passengers, unrelatedLedger)
  const injected = inject55MinuteDelay(baseline)
  const connection = injected.currentRankings.find((item) => item.itineraryId === 'synthetic-connection')
  const alternative = injected.currentRankings.find((item) => item.itineraryId === 'synthetic-direct-alternative')
  assert.equal(baseline.currentRankings.find((item) => item.itineraryId === 'synthetic-connection')?.status, 'risky')
  assert.equal(connection?.status, 'infeasible')
  assert.equal(connection?.score, null)
  assert.equal(alternative?.status, 'feasible')
  assert.ok(alternative?.score !== null && alternative?.score !== undefined)
  assert.equal(injected.currentRankings[0].itineraryId, 'synthetic-direct-alternative')
  assert.ok(injected.changes.find((item) => item.itineraryId === 'synthetic-connection')?.beforeRank !== null)
  assert.equal(injected.changes.find((item) => item.itineraryId === 'synthetic-connection')?.afterRank, null)
  assert.equal(injected.activeEvents[0].delayMinutes, 55)
})

test('injection and reset preserve passenger profiles and unrelated refund ledger records', () => {
  const baseline = createBaselineSimulation(passengers, unrelatedLedger)
  const injected = inject55MinuteDelay(baseline)
  assert.strictEqual(injected.passengers, passengers)
  assert.strictEqual(injected.refundRecords, unrelatedLedger)
  const reset = resetSimulation(injected)
  assert.strictEqual(reset.passengers, passengers)
  assert.strictEqual(reset.refundRecords, unrelatedLedger)
  assert.deepEqual(reset.activeEvents, [])
  assert.equal(reset.currentRankings.find((item) => item.itineraryId === 'synthetic-connection')?.status, 'risky')
  assert.deepEqual(reset.history.map((item) => item.action), ['inject-55-minute-delay', 'reset-to-baseline'])
})

test('the same event sequence is reproducible and duplicate clicks are idempotent', () => {
  const first = inject55MinuteDelay(createBaselineSimulation(passengers))
  const second = inject55MinuteDelay(createBaselineSimulation(passengers))
  assert.deepEqual(first.currentRankings, second.currentRankings)
  assert.deepEqual(first.history, second.history)
  assert.strictEqual(inject55MinuteDelay(first), first)
})

test('reports when the injected delay leaves no feasible alternative', () => {
  const baseline = createBaselineSimulation(passengers)
  const onlyConnection = baseline.baselineItineraries.filter((itinerary) => itinerary.id === 'synthetic-connection')
  const connectionOnlyState = { ...baseline, baselineItineraries: onlyConnection, currentItineraries: onlyConnection, baselineRankings: rankItineraries(onlyConnection), currentRankings: rankItineraries(onlyConnection) }
  const injected = inject55MinuteDelay(connectionOnlyState)
  assert.equal(hasValidAlternative(injected), false)
})

test('simulation accepts current edited passenger profiles without modifying the source records', () => {
  const baseline = createBaselineSimulation(passengers)
  const edited: PassengerProfile[] = [{ id: 'traveller-1', name: 'Changed in form', category: 'accessible' }]
  const injected = inject55MinuteDelay(baseline, edited)
  assert.strictEqual(injected.passengers, edited)
  assert.equal(injected.currentItineraries[0].passengers[0].category, 'accessible')
  assert.equal(passengers[0].name, 'Demo traveller')
})
