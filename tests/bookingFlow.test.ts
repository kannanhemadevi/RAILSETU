import assert from 'node:assert/strict'
import test from 'node:test'
import { pageFromPath, pagePaths } from '../src/engine/appNavigation.ts'
import { finalizeDemoPayment } from '../src/engine/booking.ts'
import { planJourney } from '../src/engine/planJourney.ts'
import { journeyLegSelectionKey, supportedClassesForLeg, calculateJourneyClassFare } from '../src/engine/trainSelection.ts'

const route = planJourney({ origin: 'NDLS', destination: 'JP', date: '2030-01-07', time: '06:00', passengers: 1 })[0]!
const passenger = { id: 'p-demo', name: 'Demo Passenger', category: 'Adult' as const }
const selections = Object.fromEntries(route.legs.map((leg, index) => {
  const cls = supportedClassesForLeg(route, index)[0]!
  return [journeyLegSelectionKey(route.id, index, leg.service.id), { classCode: cls.code, preferenceCode: 'none' }]
}))
const fare = calculateJourneyClassFare(route, 1, selections)!

test('supported direct page URLs and legacy Journey Planner URLs resolve to distinct views', () => {
  assert.equal(pageFromPath('/'), 'dashboard')
  assert.equal(pageFromPath('/journey-results'), 'results')
  assert.equal(pageFromPath('/route-review'), 'review')
  assert.equal(pageFromPath('/journey-planner'), 'dashboard')
  assert.equal(pageFromPath('/not-a-page'), 'dashboard')
  assert.equal(new Set(Object.values(pagePaths)).size, Object.keys(pagePaths).length)
})

test('demo payment success creates one passenger-linked booking with route and class snapshot', () => {
  const attempt = { id: 'attempt-1', method: 'demo-upi' as const, outcome: 'success' as const }
  const result = finalizeDemoPayment(attempt, route, [passenger], selections, fare, [], '2030-01-07T10:00:00.000Z')
  assert.equal(result.status, 'success-demo')
  assert.equal(result.booking?.passengers[0]?.id, passenger.id)
  assert.equal(result.booking?.itinerary.id, route.id)
  assert.equal(result.booking?.fare.totalFarePaise, fare.totalFarePaise)
  const duplicate = finalizeDemoPayment(attempt, route, [passenger], selections, fare, [result.booking!])
  assert.equal(duplicate.status, 'duplicate-demo')
  assert.equal(duplicate.booking?.reference, result.booking?.reference)
})

test('demo payment failure does not create a booking or charge money', () => {
  const result = finalizeDemoPayment({ id: 'attempt-fail', method: 'demo-card', outcome: 'failure' }, route, [passenger], selections, fare, [])
  assert.equal(result.status, 'failed-demo')
  assert.equal(result.booking, undefined)
})
