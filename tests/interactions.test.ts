import assert from 'node:assert/strict'
import test from 'node:test'
import { runDecisionEvaluation } from '../src/engine/evaluation.ts'
import { buildJourneyPack } from '../src/engine/journeyPack.ts'
import { planJourney } from '../src/engine/planJourney.ts'
import { stations } from '../src/data/railway.ts'
import type { Passenger } from '../src/types/journey.ts'

const passengers: Passenger[] = [{ id: 'pack-p1', name: 'Asha', category: 'Adult' }]

test('in-app evaluation reports actual fixed decision-engine outcomes', () => {
  const checks = runDecisionEvaluation()
  assert.equal(checks.length, 4)
  assert.ok(checks.every((check) => check.passed), checks.map((check) => `${check.id}: ${check.detail}`).join('\n'))
  assert.match(checks[1].detail, /-15/)
})

test('journey pack includes selected synthetic itinerary, legs, transfer and passenger information', () => {
  const route = planJourney({ origin: 'NDLS', destination: 'JP', date: '2030-01-07', time: '06:00', passengers: 1 })[0]
  assert.ok(route)
  const pack = buildJourneyPack(route, passengers)
  assert.match(pack, new RegExp(route.id))
  assert.match(pack, new RegExp(stations.find((station) => station.id === 'NDLS')!.name))
  assert.match(pack, /Asha \(Adult\)/)
  assert.match(pack, /SYNTHETIC DEMO ONLY/)
  assert.match(pack, /Train legs and connections/)
  assert.match(pack, /Feasibility and decision explanations/)
})
