import type { CarHelpPreference, JourneyClassSelectionState, JourneyOption, MealPreference, Passenger } from '../types/journey.ts'
import { journeyLegSelectionKey, supportedClassesForLeg } from './trainSelection.ts'

/** Prototype convenience rule only. It does not predict or guarantee an allocation. */
export function qualifiesForSeniorBerthDefault(age: unknown): age is number {
  return typeof age === 'number' && Number.isInteger(age) && age >= 60 && age <= 120
}

export function seniorBerthDefault(age: unknown, supportedPreferenceCodes: readonly string[]): 'lower' | null {
  return qualifiesForSeniorBerthDefault(age) && supportedPreferenceCodes.includes('lower') ? 'lower' : null
}

/** Apply defaults only where the passenger has not made a deliberate per-leg choice. */
export function applySeniorBerthDefaults(passengers: Passenger[], route: JourneyOption, selections: JourneyClassSelectionState): Passenger[] {
  return passengers.map((passenger) => {
    const preferences = { ...passenger.berthPreferences }
    const sources = { ...passenger.berthPreferenceSources }
    let changed = false
    route.legs.forEach((leg, index) => {
      const key = journeyLegSelectionKey(route.id, index, leg.service.id)
      const selection = selections[key]
      const selectedClass = supportedClassesForLeg(route, index).find((option) => option.code === selection?.classCode)
      const supportedCodes = selectedClass?.seatPreferences.map((item) => item.code) ?? []
      if (sources[key] === 'manual') {
        if (!supportedCodes.includes(preferences[key] ?? '')) {
          delete preferences[key]
          delete sources[key]
          changed = true
        }
        return
      }
      const preference = seniorBerthDefault(passenger.age, supportedCodes)
      if (preference) {
        if (preferences[key] !== preference || sources[key] !== 'automatic') changed = true
        preferences[key] = preference
        sources[key] = 'automatic'
      } else if (sources[key] === 'automatic') {
        delete preferences[key]
        delete sources[key]
        changed = true
      }
    })
    return changed ? { ...passenger, berthPreferences: preferences, berthPreferenceSources: sources } : passenger
  })
}

export function setPassengerBerthPreference(passengers: Passenger[], passengerId: string, legKey: string, preferenceCode: string): Passenger[] {
  return passengers.map((passenger) => passenger.id !== passengerId ? passenger : {
    ...passenger,
    berthPreferences: { ...passenger.berthPreferences, [legKey]: preferenceCode },
    berthPreferenceSources: { ...passenger.berthPreferenceSources, [legKey]: 'manual' },
  })
}

export function setPassengerMealPreference(passengers: Passenger[], passengerId: string, mealPreference: MealPreference): Passenger[] {
  return passengers.map((passenger) => passenger.id === passengerId ? { ...passenger, mealPreference } : passenger)
}

export function setPassengerDisabilityAssistance(passengers: Passenger[], passengerId: string, selected: boolean): Passenger[] {
  return passengers.map((passenger) => passenger.id === passengerId
    ? { ...passenger, passengerWithDisabilities: selected, ...(selected ? {} : { carHelpPreference: undefined }) }
    : passenger)
}

export function pendingCarHelpPassenger(passengers: Passenger[]): Passenger | undefined {
  return passengers.find((passenger) => passenger.passengerWithDisabilities && passenger.carHelpPreference === undefined)
}

/** Returns an updated copy and leaves every other passenger record untouched. */
export function recordCarHelpPreference(passengers: Passenger[], passengerId: string, choice: CarHelpPreference): Passenger[] {
  return passengers.map((passenger) => passenger.id === passengerId && passenger.passengerWithDisabilities
    ? { ...passenger, carHelpPreference: choice }
    : passenger)
}

export function mealPreferenceLabelKey(preference: MealPreference): 'mealVegetarian' | 'mealNonVegetarian' | 'mealJain' | 'mealNone' {
  return ({ vegetarian: 'mealVegetarian', 'non-vegetarian': 'mealNonVegetarian', jain: 'mealJain', 'no-meal': 'mealNone' } as const)[preference]
}
