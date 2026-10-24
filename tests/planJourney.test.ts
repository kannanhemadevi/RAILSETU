import assert from 'node:assert/strict'
import test from 'node:test'
import { disruptions, stations } from '../src/data/railway.ts'
import { planJourney } from '../src/engine/planJourney.ts'
import type { JourneyRequest, Service } from '../src/types/journey.ts'

const request = (origin: string, destination: string, time = '07:00'): JourneyRequest => ({
  origin,
  destination,
  date: '2030-01-07',
  time,
  passengers: 1,
  priorities: { reliability: 55, comfort: 25, speed: 20 },
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
