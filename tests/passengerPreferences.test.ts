import assert from 'node:assert/strict'
import test from 'node:test'
import { planJourney } from '../src/engine/planJourney.ts'
import { applySeniorBerthDefaults, pendingCarHelpPassenger, qualifiesForSeniorBerthDefault, recordCarHelpPreference, seniorBerthDefault, setPassengerBerthPreference, setPassengerDisabilityAssistance, setPassengerMealPreference } from '../src/engine/passengerPreferences.ts'
import { journeyLegSelectionKey, supportedClassesForLeg } from '../src/engine/trainSelection.ts'
import type { JourneyClassSelectionState, JourneyOption, MealPreference, Passenger } from '../src/types/journey.ts'

function routeWithBerths(): JourneyOption {
  const route = planJourney({ origin: 'NDLS', destination: 'JP', date: '2030-01-07', time: '06:00', passengers: 1 }).find((item) => item.legs.some((leg, index) => supportedClassesForLeg(item, index).some((option) => option.seatPreferences.some((pref) => pref.code === 'lower'))))!
  return route
}
function selectionsFor(route: JourneyOption, classCode?: string): JourneyClassSelectionState {
  return Object.fromEntries(route.legs.map((leg, index) => {
    const options = supportedClassesForLeg(route, index)
    const selected = options.find((option) => option.code === classCode) ?? options[0]!
    const pref = selected.seatPreferences.some((item) => item.code === 'none') ? 'none' : selected.seatPreferences[0]!.code
    return [journeyLegSelectionKey(route.id, index, leg.service.id), { classCode: selected.code, preferenceCode: pref }]
  }))
}
const person = (id: string, age?: number): Passenger => ({ id, name: id, category: 'Adult', age })

test('senior default uses the explicit 60+ demo threshold and rejects missing or invalid ages', () => {
  assert.equal(qualifiesForSeniorBerthDefault(59), false)
  assert.equal(qualifiesForSeniorBerthDefault(60), true)
  assert.equal(qualifiesForSeniorBerthDefault(61), true)
  for (const invalid of [undefined, null, '60', 0, -1, 120.5, 121, Number.NaN]) assert.equal(qualifiesForSeniorBerthDefault(invalid), false)
  assert.equal(seniorBerthDefault(59, ['lower']), null)
  assert.equal(seniorBerthDefault(60, ['lower']), 'lower')
  assert.equal(seniorBerthDefault(61, ['upper']), null)
})

test('ages 60 and 61 get one automatic lower berth per supported leg while age 59 does not', () => {
  const route = routeWithBerths()
  const selections = selectionsFor(route, '3A')
  const aged = applySeniorBerthDefaults([person('59', 59), person('60', 60), person('61', 61)], route, selections)
  const leg = route.legs.find((_, index) => supportedClassesForLeg(route, index).find((option) => option.code === selections[journeyLegSelectionKey(route.id,index,route.legs[index]!.service.id)]?.classCode)?.seatPreferences.some((pref) => pref.code === 'lower'))!
  const index = route.legs.indexOf(leg)
  const key = journeyLegSelectionKey(route.id,index,leg.service.id)
  assert.equal(aged[0]?.berthPreferences?.[key], undefined)
  assert.equal(aged[1]?.berthPreferences?.[key], 'lower')
  assert.equal(aged[2]?.berthPreferences?.[key], 'lower')
  assert.equal(aged[1]?.berthPreferenceSources?.[key], 'automatic')
})

test('manual berth changes persist through age changes; seating-only classes receive no berth default', () => {
  const route = routeWithBerths()
  const selections = selectionsFor(route, '3A')
  const legIndex = route.legs.findIndex((_, index) => supportedClassesForLeg(route,index).some((option) => option.code === '3A' && option.seatPreferences.some((pref) => pref.code === 'upper')))
  const key = journeyLegSelectionKey(route.id,legIndex,route.legs[legIndex]!.service.id)
  const manual = setPassengerBerthPreference([person('senior',59)],'senior',key,'upper')
  const afterAgeChange = applySeniorBerthDefaults([{ ...manual[0]!, age: 60 }],route,selections)
  assert.equal(afterAgeChange[0]?.berthPreferences?.[key],'upper')
  assert.equal(afterAgeChange[0]?.berthPreferenceSources?.[key],'manual')

  const sittingRoute = planJourney({ origin: 'NDLS', destination: 'AGC', date: '2030-01-07', time: '06:00', passengers: 1 }).find((item) => supportedClassesForLeg(item,0).some((option) => option.code === 'CC' && option.seatPreferences.every((pref) => pref.kind !== 'berth')))
  assert.ok(sittingRoute)
  const sittingSelections = selectionsFor(sittingRoute!, 'CC')
  const sitting = applySeniorBerthDefaults([person('seated',70)],sittingRoute!,sittingSelections)
  assert.deepEqual(sitting[0]?.berthPreferences,undefined)
})

test('all meal values are typed and update only the selected passenger', () => {
  const meals: MealPreference[] = ['vegetarian','non-vegetarian','jain','no-meal']
  let people = [person('first'),person('second')]
  for (const meal of meals) people = setPassengerMealPreference(people,'first',meal)
  assert.equal(people[0]?.mealPreference,'no-meal')
  assert.equal(people[1]?.mealPreference,undefined)
})

test('disability response is required only for selected passengers and remains passenger-specific', () => {
  const base = [person('one'),person('two')]
  const selected = setPassengerDisabilityAssistance(base,'one',true)
  assert.equal(pendingCarHelpPassenger(selected)?.id,'one')
  // Dismissing the view without recording an explicit answer leaves consent pending.
  assert.equal(pendingCarHelpPassenger(selected)?.carHelpPreference,undefined)
  assert.equal(pendingCarHelpPassenger(setPassengerDisabilityAssistance(base,'one',false)),undefined)
  const answered = recordCarHelpPreference(selected,'one','yes')
  assert.equal(pendingCarHelpPassenger(answered),undefined)
  assert.equal(answered[0]?.carHelpPreference,'yes')
  assert.equal(answered[1]?.passengerWithDisabilities,undefined)
  const declined = recordCarHelpPreference(selected,'one','no')
  assert.equal(declined[0]?.carHelpPreference,'no')
  assert.equal(declined[1]?.carHelpPreference,undefined)
  const cleared = setPassengerDisabilityAssistance(answered,'one',false)
  assert.equal(cleared[0]?.carHelpPreference,undefined)
  assert.equal(cleared[1]?.carHelpPreference,undefined)
})
