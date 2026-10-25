import assert from 'node:assert/strict'
import test from 'node:test'
import { services } from '../src/data/railway.ts'
import { planJourney } from '../src/engine/planJourney.ts'
import { calculateJourneyClassFare, journeyLegSelectionKey, supportedClassesForLeg, validateJourneyClassSelection } from '../src/engine/trainSelection.ts'
import type { JourneyClassSelectionState, JourneyOption } from '../src/types/journey.ts'

function findRoute(from: string, to: string, transferCount?: number): JourneyOption {
  const route = planJourney({ origin: from, destination: to, date: '2030-01-07', time: '06:00', passengers: 1 }).find((candidate) => transferCount === undefined || candidate.transferCount === transferCount)
  assert.ok(route, `Expected a generated demo route from ${from} to ${to}`)
  return route
}

function completeSelection(route: JourneyOption, codes: string[]): JourneyClassSelectionState {
  return Object.fromEntries(route.legs.map((leg, index) => [
    journeyLegSelectionKey(route.id, index, leg.service.id),
    { classCode: codes[index] as '1A' | '2A' | '3A' | 'SL' | 'CC' | '2S', preferenceCode: 'none' },
  ]))
}

test('generated service class fixtures vary by train and expose synthetic demo status', () => {
  assert.ok(services.every((service) => (service.syntheticClasses?.length ?? 0) > 0), 'Every dropdown-network service must have typed synthetic class options.')
  const direct = findRoute('NDLS', 'JP', 0)
  const directClasses = supportedClassesForLeg(direct, 0)
  const shortService = findRoute('NDLS', 'AGC', 0)
  const shortClasses = supportedClassesForLeg(shortService, 0)
  assert.ok(directClasses.some((option) => option.code === '1A'))
  assert.ok(!shortClasses.some((option) => option.code === '1A'))
  assert.ok(directClasses.every((option) => Number.isSafeInteger(option.farePaisePerPassenger) && option.farePaisePerPassenger > 0))
  assert.ok(directClasses.every((option) => ['available-demo', 'limited-demo'].includes(option.demoAvailability)))
})

test('a supported class selection validates and an unsupported class is rejected', () => {
  const route = findRoute('NDLS', 'AGC', 0)
  const supported = supportedClassesForLeg(route, 0)[0]
  assert.equal(validateJourneyClassSelection(route, 1, completeSelection(route, [supported.code])).valid, true)
  const unsupported = supportedClassesForLeg(findRoute('NDLS', 'JP', 0), 0).find((option) => option.code === '1A')
  assert.ok(unsupported)
  const invalid = completeSelection(route, ['1A'])
  const validation = validateJourneyClassSelection(route, 1, invalid)
  assert.equal(validation.valid, false)
  assert.match(validation.errors.join(' '), /not supported/i)
  assert.equal(calculateJourneyClassFare(route, 1, invalid), null)
})

test('connecting itinerary can carry a different supported class on each leg', () => {
  const route = findRoute('NDLS', 'JP', 1)
  assert.equal(route.legs.length, 2)
  const firstClass = supportedClassesForLeg(route, 0).find((option) => option.code === 'CC')
  const secondClass = supportedClassesForLeg(route, 1).find((option) => option.code === '2A')
  assert.ok(firstClass)
  assert.ok(secondClass)
  const state = completeSelection(route, [firstClass.code, secondClass.code])
  assert.equal(validateJourneyClassSelection(route, 2, state).valid, true)
  const fare = calculateJourneyClassFare(route, 2, state)
  assert.ok(fare)
  assert.equal(fare.legs[0].classCode, 'CC')
  assert.equal(fare.legs[1].classCode, '2A')
})

test('synthetic fare total recalculates for passenger-count changes using integer paise', () => {
  const route = findRoute('NDLS', 'JP', 0)
  const classCode = supportedClassesForLeg(route, 0)[0].code
  const selections = completeSelection(route, [classCode])
  const one = calculateJourneyClassFare(route, 1, selections)
  const three = calculateJourneyClassFare(route, 3, selections)
  assert.ok(one && three)
  assert.equal(three.perPassengerFarePaise, one.perPassengerFarePaise)
  assert.equal(three.totalFarePaise, one.totalFarePaise * 3)
  assert.ok(Number.isSafeInteger(three.totalFarePaise))
  assert.equal(calculateJourneyClassFare(route, 0, selections), null)
})

test('berth and seat preferences are class-specific and validated', () => {
  const direct = findRoute('NDLS', 'JP', 0)
  const service = direct.legs[0].service
  const sleeper = supportedClassesForLeg(direct, 0).find((option) => option.code === '3A')
  assert.ok(sleeper?.seatPreferences.some((preference) => preference.code === 'lower' && preference.kind === 'berth'))
  const sleeperChoice = completeSelection(direct, ['3A'])
  const key = journeyLegSelectionKey(direct.id, 0, service.id)
  sleeperChoice[key].preferenceCode = 'lower'
  assert.equal(validateJourneyClassSelection(direct, 1, sleeperChoice).valid, true)

  const chairRoute = findRoute('NDLS', 'AGC', 0)
  const chairClass = supportedClassesForLeg(chairRoute, 0).find((option) => option.code === 'CC')
  assert.ok(chairClass?.seatPreferences.some((preference) => preference.code === 'window' && preference.kind === 'seat'))
  const invalidChairChoice = completeSelection(chairRoute, ['CC'])
  invalidChairChoice[journeyLegSelectionKey(chairRoute.id, 0, chairRoute.legs[0].service.id)].preferenceCode = 'lower'
  assert.equal(validateJourneyClassSelection(chairRoute, 1, invalidChairChoice).valid, false)
})

test('missing class selections are rejected for every leg before continuing', () => {
  const route = findRoute('NDLS', 'JP', 1)
  const validation = validateJourneyClassSelection(route, 1, {})
  assert.equal(validation.valid, false)
  assert.equal(validation.errors.length, route.legs.length)
  assert.match(validation.errors[0], /Choose a class/)
})
