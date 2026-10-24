import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateItinerary, rankItineraries } from '../src/engine/decisionEngine.ts'
import type { DisruptionEvent, Itinerary, RefundRecord, TrainLeg } from '../src/types/decision.ts'

const leg = (overrides: Partial<TrainLeg> = {}): TrainLeg => ({
  id: 'leg-1', serviceId: 'synthetic-service-1', fromStationId: 'NDLS', toStationId: 'AGC',
  scheduledDepartureAt: '2030-01-07T08:00:00.000Z', scheduledArrivalAt: '2030-01-07T09:00:00.000Z', ticketStatus: 'confirmed', ...overrides,
})

const connectingItinerary = (options: { category?: 'adult' | 'senior' | 'child' | 'accessible'; connectionMinutes?: number; delayMinutes?: number; caregiverMinimum?: number } = {}): Itinerary => {
  const first = leg()
  const second = leg({ id: 'leg-2', serviceId: 'synthetic-service-2', fromStationId: 'AGC', toStationId: 'JP', scheduledDepartureAt: `2030-01-07T09:${String(options.connectionMinutes ?? 40).padStart(2, '0')}:00.000Z`, scheduledArrivalAt: '2030-01-07T11:00:00.000Z' })
  const disruptionEvents: DisruptionEvent[] = options.delayMinutes ? [{ id: 'demo-delay', kind: 'delay', affectedLegId: first.id, delayMinutes: options.delayMinutes, severity: 'high', description: `${options.delayMinutes}-minute synthetic delay`, synthetic: true }] : []
  return {
    id: 'itinerary-1', legs: [first, second], passengers: [{ id: 'p1', category: options.category ?? 'adult' }], disruptionEvents,
    caregiverConstraints: options.caregiverMinimum ? [{ caregiverPassengerId: 'p1', dependentPassengerIds: ['p2'], minimumTransferMinutes: options.caregiverMinimum }] : [],
  }
}

test('confirmed tickets do not make an infeasible transfer feasible', () => {
  const decision = evaluateItinerary(connectingItinerary({ category: 'accessible', connectionMinutes: 40, delayMinutes: 55 }))
  assert.equal(decision.status, 'infeasible')
  assert.equal(decision.score, null)
  assert.equal(decision.transferFeasibility[0].slackMinutes, -55)
  assert.ok(decision.explanations.some((item) => item.code === 'TICKET_STATUS_NOT_FEASIBILITY'))
})

test('a 40-minute connection meets an accessible passenger minimum at the boundary', () => {
  const decision = evaluateItinerary(connectingItinerary({ category: 'accessible', connectionMinutes: 40 }))
  assert.equal(decision.transferFeasibility[0].requiredMinutes, 40)
  assert.equal(decision.transferFeasibility[0].slackMinutes, 0)
  assert.equal(decision.status, 'risky')
})

test('caregiver constraints raise the minimum transfer time for the group', () => {
  const decision = evaluateItinerary(connectingItinerary({ caregiverMinimum: 50, connectionMinutes: 49 }))
  assert.equal(decision.transferFeasibility[0].requiredMinutes, 50)
  assert.equal(decision.status, 'infeasible')
})

test('a mismatched transfer station is a hard constraint failure', () => {
  const itinerary = connectingItinerary()
  itinerary.legs[1].fromStationId = 'LKO'
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.explanations.some((item) => item.code === 'STATION_MISMATCH'))
})

test('malformed transfer timestamps return an infeasible decision instead of crashing', () => {
  const itinerary = connectingItinerary()
  itinerary.legs[1].scheduledDepartureAt = 'not-a-timestamp'
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.explanations.some((item) => item.code === 'INVALID_LEG_TIME'))
  assert.ok(decision.explanations.some((item) => item.code === 'TRANSFER_INFEASIBLE'))
})

test('invalid configurable weights are rejected explicitly', () => {
  const itinerary = connectingItinerary()
  assert.throws(() => evaluateItinerary(itinerary, { reliability: 0, duration: 0, fewerTransfers: 0, transferSlack: 0 }), /weights must be finite/i)
  assert.throws(() => evaluateItinerary(itinerary, { reliability: Number.NaN, duration: 1, fewerTransfers: 0, transferSlack: 0 }), /weights must be finite/i)
})

test('cancellation is a hard constraint even when tickets are confirmed', () => {
  const itinerary = connectingItinerary()
  itinerary.disruptionEvents = [{ id: 'cancel-1', kind: 'cancellation', affectedLegId: 'leg-1', severity: 'high', description: 'Synthetic cancellation', synthetic: true }]
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.explanations.some((item) => item.code === 'LEG_CANCELLED'))
})

test('a synthetic closure of a leg station is a hard constraint', () => {
  const itinerary = connectingItinerary()
  itinerary.disruptionEvents = [{ id: 'closure-1', kind: 'station_closure', affectedStationId: 'AGC', severity: 'high', description: 'Synthetic station closure', synthetic: true }]
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.explanations.some((item) => item.code === 'STATION_CLOSED'))
})

test('ranking is deterministic and puts feasible itineraries ahead of infeasible ones', () => {
  const tiedA: Itinerary = { id: 'a-itinerary', legs: [leg({ id: 'a-leg' })], passengers: [{ id: 'p1', category: 'adult' }] }
  const tiedB: Itinerary = { id: 'b-itinerary', legs: [leg({ id: 'b-leg' })], passengers: [{ id: 'p1', category: 'adult' }] }
  const impossible: Itinerary = { id: 'z-impossible', legs: [], passengers: [] }
  const first = rankItineraries([tiedB, impossible, tiedA]).map((item) => item.itineraryId)
  const second = rankItineraries([tiedA, tiedB, impossible]).map((item) => item.itineraryId)
  assert.deepEqual(first, ['a-itinerary', 'b-itinerary', 'z-impossible'])
  assert.deepEqual(second, first)
})

test('refund records have a typed synthetic representation', () => {
  const record: RefundRecord = { id: 'refund-1', itineraryId: 'itinerary-1', passengerId: 'p1', amountPaise: 12000, currency: 'INR', status: 'requested', reason: 'Synthetic demo delay scenario', recordedAt: '2030-01-07T12:00:00.000Z', synthetic: true }
  assert.equal(record.synthetic, true)
  assert.equal(record.status, 'requested')
})
