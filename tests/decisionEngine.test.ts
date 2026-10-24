import assert from 'node:assert/strict'
import test from 'node:test'
import { evaluateItinerary, rankItineraries } from '../src/engine/decisionEngine.ts'
import type { DisruptionEvent, Itinerary, RankingConfiguration, RefundRecord, TrainLeg } from '../src/types/decision.ts'

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

const scoredDirect = (id: string, scoringFactors: NonNullable<Itinerary['scoringFactors']>, passengerOverrides: Partial<Itinerary['passengers'][number]> = {}): Itinerary => ({
  id,
  legs: [leg({ id: `${id}-leg`, toStationId: 'JP', scheduledArrivalAt: '2030-01-07T11:00:00.000Z' })],
  passengers: [{ id: 'p1', category: 'adult', ...passengerOverrides }],
  scoringFactors,
})

const arrivalFocused: RankingConfiguration = { weights: { arrivalTimeRisk: 100, connectionRisk: 0, fare: 0, confirmationUncertainty: 0, accessibilityPreference: 0 } }

test('confirmed tickets do not make an infeasible transfer feasible', () => {
  const decision = evaluateItinerary(connectingItinerary({ category: 'accessible', connectionMinutes: 40, delayMinutes: 55 }))
  assert.equal(decision.status, 'infeasible')
  assert.equal(decision.score, null)
  assert.equal(decision.transferFeasibility[0].remainingConnectionMinutes, -15)
  assert.equal(decision.transferFeasibility[0].slackMinutes, -55)
  assert.ok(decision.explanations.some((item) => item.code === 'TICKET_STATUS_NOT_FEASIBILITY'))
})

test('55-minute delay leaves -15 minutes and misses a 30-minute group minimum by 45 minutes', () => {
  const decision = evaluateItinerary(connectingItinerary({ connectionMinutes: 40, delayMinutes: 55, caregiverMinimum: 30 }))
  const transfer = decision.transferFeasibility[0]
  assert.equal(transfer.remainingConnectionMinutes, -15)
  assert.equal(transfer.requiredMinutes, 30)
  assert.equal(transfer.slackMinutes, -45)
  assert.equal(transfer.status, 'infeasible')
  assert.match(transfer.explanation, /remaining connection time is -15 minutes/i)
  assert.match(transfer.explanation, /misses .* minimum of 30 minutes by 45 minutes/i)
})

test('negative remaining time stays infeasible when minimum is only 15 minutes', () => {
  const itinerary = connectingItinerary({ connectionMinutes: 40, delayMinutes: 55, caregiverMinimum: 15 })
  itinerary.passengers = []
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.transferFeasibility[0].requiredMinutes, 15)
  assert.equal(decision.transferFeasibility[0].remainingConnectionMinutes, -15)
  assert.equal(decision.transferFeasibility[0].status, 'infeasible')
})

test('a 40-minute connection meets an accessible passenger minimum at the boundary', () => {
  const decision = evaluateItinerary(connectingItinerary({ category: 'accessible', connectionMinutes: 40 }))
  assert.equal(decision.transferFeasibility[0].requiredMinutes, 40)
  assert.equal(decision.transferFeasibility[0].slackMinutes, 0)
  assert.equal(decision.status, 'risky')
})

test('remaining time exactly equal to the required minimum is not infeasible', () => {
  const decision = evaluateItinerary(connectingItinerary({ category: 'accessible', connectionMinutes: 40 }))
  assert.equal(decision.transferFeasibility[0].remainingConnectionMinutes, 40)
  assert.equal(decision.transferFeasibility[0].slackMinutes, 0)
  assert.notEqual(decision.transferFeasibility[0].status, 'infeasible')
})

test('remaining time one minute below the required minimum is infeasible', () => {
  const decision = evaluateItinerary(connectingItinerary({ connectionMinutes: 29, caregiverMinimum: 30 }))
  assert.equal(decision.transferFeasibility[0].remainingConnectionMinutes, 29)
  assert.equal(decision.transferFeasibility[0].slackMinutes, -1)
  assert.equal(decision.transferFeasibility[0].status, 'infeasible')
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
  assert.ok(decision.rejectionReasons.some((item) => item.code === 'STATION_MISMATCH'))
})

test('malformed transfer timestamps return an infeasible decision instead of crashing', () => {
  const itinerary = connectingItinerary()
  itinerary.legs[1].scheduledDepartureAt = 'not-a-timestamp'
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.rejectionReasons.some((item) => item.code === 'INVALID_LEG_TIME'))
  assert.ok(decision.explanations.some((item) => item.code === 'TRANSFER_INFEASIBLE'))
})

test('invalid configurable weights are rejected explicitly', () => {
  const itinerary = connectingItinerary()
  assert.throws(() => evaluateItinerary(itinerary, { weights: { arrivalTimeRisk: 0, connectionRisk: 0, fare: 0, confirmationUncertainty: 0, accessibilityPreference: 0 } }), /weights must be finite/i)
  assert.throws(() => evaluateItinerary(itinerary, { weights: { arrivalTimeRisk: Number.NaN, connectionRisk: 1, fare: 0, confirmationUncertainty: 0, accessibilityPreference: 0 } }), /weights must be finite/i)
})

test('mandatory accessibility rejects a low-fare itinerary before scoring', () => {
  const lowFare = scoredDirect('low-fare-missing-access', {
    arrivalTimeRisk: 0, connectionRisk: 0, farePaise: 1, confirmationUncertainty: 0, accessibilityPreferenceSatisfaction: 100, synthetic: true,
  }, { mandatoryAccessibilityFeatures: ['step-free-boarding'] })
  const decision = evaluateItinerary(lowFare)
  assert.equal(decision.accepted, false)
  assert.equal(decision.score, null)
  assert.equal(decision.scoreExplanations.length, 0)
  assert.ok(decision.rejectionReasons.some((reason) => reason.code === 'MANDATORY_ACCESSIBILITY_UNAVAILABLE'))
})

test('infeasible transfers are rejected before an otherwise perfect weighted score', () => {
  const impossible = connectingItinerary({ connectionMinutes: 20 })
  impossible.scoringFactors = { arrivalTimeRisk: 0, connectionRisk: 0, farePaise: 0, confirmationUncertainty: 0, accessibilityPreferenceSatisfaction: 100, synthetic: true }
  const safe = scoredDirect('safe-direct', { arrivalTimeRisk: 80, connectionRisk: 20, farePaise: 90000, confirmationUncertainty: 40, accessibilityPreferenceSatisfaction: 20, synthetic: true })
  const decisions = rankItineraries([impossible, safe], arrivalFocused)
  assert.equal(decisions[0].itineraryId, 'safe-direct')
  const rejected = decisions.find((item) => item.itineraryId === impossible.id)!
  assert.equal(rejected.accepted, false)
  assert.equal(rejected.score, null)
  assert.ok(rejected.rejectionReasons.some((reason) => reason.code === 'INFEASIBLE_TRANSFER'))
})

test('valid preference weight changes can change the winner', () => {
  const lowRiskExpensive = scoredDirect('risk-priority', { arrivalTimeRisk: 0, connectionRisk: 0, farePaise: 100000, confirmationUncertainty: 100, accessibilityPreferenceSatisfaction: 0, synthetic: true })
  const balancedCheap = scoredDirect('balanced-priority', { arrivalTimeRisk: 25, connectionRisk: 25, farePaise: 10000, confirmationUncertainty: 0, accessibilityPreferenceSatisfaction: 100, synthetic: true })
  const balanced = rankItineraries([lowRiskExpensive, balancedCheap])
  const arrivalOnly = rankItineraries([lowRiskExpensive, balancedCheap], arrivalFocused)
  assert.equal(balanced[0].itineraryId, 'balanced-priority')
  assert.equal(arrivalOnly[0].itineraryId, 'risk-priority')
})

test('tie-breaking uses documented connection-risk order and remains stable across input order', () => {
  const lowConnectionRisk = scoredDirect('z-low-risk', { arrivalTimeRisk: 10, connectionRisk: 5, farePaise: 50000, confirmationUncertainty: 50, accessibilityPreferenceSatisfaction: 50, synthetic: true })
  const highConnectionRisk = scoredDirect('a-high-risk', { arrivalTimeRisk: 10, connectionRisk: 80, farePaise: 50000, confirmationUncertainty: 50, accessibilityPreferenceSatisfaction: 50, synthetic: true })
  assert.deepEqual(rankItineraries([highConnectionRisk, lowConnectionRisk], arrivalFocused).map((item) => item.itineraryId), ['z-low-risk', 'a-high-risk'])
  const tiedA = scoredDirect('alpha', { arrivalTimeRisk: 10, connectionRisk: 5, farePaise: 50000, confirmationUncertainty: 50, accessibilityPreferenceSatisfaction: 50, synthetic: true })
  const tiedB = scoredDirect('beta', { arrivalTimeRisk: 10, connectionRisk: 5, farePaise: 50000, confirmationUncertainty: 50, accessibilityPreferenceSatisfaction: 50, synthetic: true })
  assert.deepEqual(rankItineraries([tiedB, tiedA], arrivalFocused).map((item) => item.itineraryId), ['alpha', 'beta'])
  assert.deepEqual(rankItineraries([tiedA, tiedB], arrivalFocused).map((item) => item.itineraryId), ['alpha', 'beta'])
})

test('score and rejection explanations are separate and accurately sum weighted factors', () => {
  const itinerary = scoredDirect('explained-route', { arrivalTimeRisk: 10, connectionRisk: 20, farePaise: 50000, confirmationUncertainty: 30, accessibilityPreferenceSatisfaction: 80, synthetic: true })
  const decision = rankItineraries([itinerary])[0]
  assert.equal(decision.accepted, true)
  assert.deepEqual(decision.rejectionReasons, [])
  assert.equal(decision.score, Math.round(decision.scoreExplanations.reduce((sum, factor) => sum + factor.weightedContribution, 0) * 100) / 100)
  assert.ok(decision.scoreExplanations.some((factor) => factor.factor === 'fare' && factor.explanation.includes('candidate-set fare')))
  assert.match(decision.rankingExplanation, /Ranked 1/)

  const rejected = evaluateItinerary(connectingItinerary({ connectionMinutes: 10 }))
  assert.ok(rejected.rejectionReasons.length > 0)
  assert.deepEqual(rejected.scoreExplanations, [])
  assert.match(rejected.rankingExplanation, /^Rejected:/)
})

test('cancellation is a hard constraint even when tickets are confirmed', () => {
  const itinerary = connectingItinerary()
  itinerary.disruptionEvents = [{ id: 'cancel-1', kind: 'cancellation', affectedLegId: 'leg-1', severity: 'high', description: 'Synthetic cancellation', synthetic: true }]
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.rejectionReasons.some((item) => item.code === 'LEG_CANCELLED'))
})

test('a synthetic closure of a leg station is a hard constraint', () => {
  const itinerary = connectingItinerary()
  itinerary.disruptionEvents = [{ id: 'closure-1', kind: 'station_closure', affectedStationId: 'AGC', severity: 'high', description: 'Synthetic station closure', synthetic: true }]
  const decision = evaluateItinerary(itinerary)
  assert.equal(decision.status, 'infeasible')
  assert.ok(decision.rejectionReasons.some((item) => item.code === 'STATION_CLOSED'))
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
