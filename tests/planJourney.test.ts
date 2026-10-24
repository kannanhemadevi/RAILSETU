import assert from 'node:assert/strict'
import test from 'node:test'
import { disruptions, stations } from '../src/data/railway.ts'
import { planJourney, planJourneyDetailed } from '../src/engine/planJourney.ts'
import type { JourneyRequest, Service } from '../src/types/journey.ts'

const request = (origin: string, destination: string, time = '07:00'): JourneyRequest => ({
  origin,
  destination,
  date: '2030-01-07',
  time,
  passengers: 1,
  rankingConfiguration: { weights: { arrivalTimeRisk: 55, connectionRisk: 55, fare: 25, confirmationUncertainty: 20, accessibilityPreference: 0 } },
})

test('finds a scheduled direct route and calculates duration', () => {
  const result = planJourney(request('NDLS', 'JP'))
  const direct = result.find((route) => route.transferCount === 0)
  assert.ok(direct)
  assert.equal(direct.legs.length, 1)
  assert.equal(direct.durationMinutes, (direct.arrival.getTime() - direct.departure.getTime()) / 60000)
  const originalDemoService = result.find((route) => route.legs[0].service.id === 's3')
  assert.ok(originalDemoService)
  assert.equal(originalDemoService.durationMinutes, 305)
})

test('finds a connecting route with station-matched legs and sufficient buffer', () => {
  const feeder: Service = { id: 'test-feeder', number: 'DEMO 01', from: 'NDLS', to: 'AGC', depart: '07:00', arrive: '08:00', days: [1], classLabel: 'Synthetic test' }
  const onward: Service = { id: 'test-onward', number: 'DEMO 02', from: 'AGC', to: 'JP', depart: '08:35', arrive: '10:00', days: [1], classLabel: 'Synthetic test' }
  const result = planJourney(request('NDLS', 'JP'), [feeder, onward], stations, disruptions)
  assert.equal(result.length, 1)
  assert.equal(result[0].transferCount, 1)
  assert.equal(result[0].bufferMinutes[0], 35)
  assert.equal(result[0].durationMinutes, 180)
  assert.equal(result[0].legs[0].to.id, result[0].legs[1].from.id)
})

test('journey search uses the shared decision engine and recalculates scores when weights change', () => {
  const arrivalRiskOnly = { weights: { arrivalTimeRisk: 100, connectionRisk: 0, fare: 0, confirmationUncertainty: 0, accessibilityPreference: 0 } }
  const fareOnly = { weights: { arrivalTimeRisk: 0, connectionRisk: 0, fare: 100, confirmationUncertainty: 0, accessibilityPreference: 0 } }
  const arrivalPlan = planJourneyDetailed({ ...request('NDLS', 'JP', '06:00'), rankingConfiguration: arrivalRiskOnly })
  const farePlan = planJourneyDetailed({ ...request('NDLS', 'JP', '06:00'), rankingConfiguration: fareOnly })
  assert.equal(arrivalPlan.options[0].transferCount, 0)
  assert.equal(farePlan.options[0].transferCount, 0)
  const arrivalScore = arrivalPlan.decisions.find((decision) => decision.itineraryId === 's3')?.score
  const fareScore = farePlan.decisions.find((decision) => decision.itineraryId === 's3')?.score
  assert.notEqual(arrivalScore, fareScore)
  assert.ok(arrivalPlan.options[0].reasons.some((reason) => reason.includes('Ranked 1')))
  assert.ok(arrivalPlan.decisions.every((decision) => decision.score !== null || decision.rejectionReasons.length > 0))
})

test('mandatory accessibility features filter synthetic options before recommendations', () => {
  const result = planJourneyDetailed({
    ...request('NDLS', 'JP', '06:00'),
    passengerProfiles: [{ id: 'p-access', category: 'accessible', mandatoryAccessibilityFeatures: ['step-free-boarding'] }],
  })
  assert.ok(result.options.length > 0)
  assert.ok(result.options.every((option) => option.legs.every((leg) => leg.service.syntheticAccessibilityFeatures?.includes('step-free-boarding'))))
  assert.ok(result.decisions.some((decision) => decision.rejectionReasons.some((reason) => reason.code === 'MANDATORY_ACCESSIBILITY_UNAVAILABLE')))
})

test('every distinct station pair in the dropdown network has a feasible route', () => {
  for (const origin of stations) {
    for (const destination of stations) {
      if (origin.id === destination.id) continue
      const result = planJourney(request(origin.id, destination.id))
      assert.ok(result.length > 0, `Expected a route from ${origin.id} to ${destination.id}`)
      assert.ok(result.every((route) => route.transferCount <= 2))
    }
  }
})

test('rejects disconnected services even when their clock times align', () => {
  const disconnected: Service[] = [
    { id: 'test-a', number: 'DEMO 11', from: 'NDLS', to: 'AGC', depart: '07:00', arrive: '08:00', days: [1], classLabel: 'Synthetic test' },
    { id: 'test-b', number: 'DEMO 12', from: 'JP', to: 'BPL', depart: '08:30', arrive: '10:00', days: [1], classLabel: 'Synthetic test' },
  ]
  assert.deepEqual(planJourney(request('NDLS', 'BPL'), disconnected, stations, []), [])
})

test('rejects a connection under the minimum transfer time', () => {
  const shortConnection: Service[] = [
    { id: 'test-short-a', number: 'DEMO 21', from: 'NDLS', to: 'AGC', depart: '07:00', arrive: '08:00', days: [1], classLabel: 'Synthetic test' },
    { id: 'test-short-b', number: 'DEMO 22', from: 'AGC', to: 'JP', depart: '08:20', arrive: '10:00', days: [1], classLabel: 'Synthetic test' },
  ]
  assert.deepEqual(planJourney(request('NDLS', 'JP'), shortConnection, stations, []), [])
})

test('rejects same-station searches', () => {
  assert.deepEqual(planJourney(request('NDLS', 'NDLS')), [])
})
