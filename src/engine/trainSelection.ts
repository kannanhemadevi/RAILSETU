import type { JourneyClassSelectionState, JourneyLegClassSelection, JourneyOption, SyntheticClassOption } from '../types/journey.ts'

export type LegClassFare = { legKey: string; serviceId: string; classCode: string; farePaisePerPassenger: number; totalFarePaise: number }
export type JourneyClassFare = { perPassengerFarePaise: number; totalFarePaise: number; legs: LegClassFare[] }
export type JourneyClassValidation = { valid: boolean; errors: string[] }

export function journeyLegSelectionKey(itineraryId: string, legIndex: number, serviceId: string): string {
  return `${itineraryId}:${legIndex}:${serviceId}`
}

export function supportedClassesForLeg(route: JourneyOption, legIndex: number): SyntheticClassOption[] {
  return route.legs[legIndex]?.service.syntheticClasses ?? []
}

export function validateJourneyClassSelection(route: JourneyOption, passengerCount: number, selections: JourneyClassSelectionState): JourneyClassValidation {
  const errors: string[] = []
  if (!Number.isInteger(passengerCount) || passengerCount < 1 || passengerCount > 5) errors.push('Passenger count must be between one and five.')
  if (!route.legs.length) errors.push('Select a generated itinerary with at least one train leg.')
  route.legs.forEach((leg, index) => {
    const key = journeyLegSelectionKey(route.id, index, leg.service.id)
    const selection = selections[key]
    const options = supportedClassesForLeg(route, index)
    if (!options.length) {
      errors.push(`No synthetic class options are defined for service ${leg.service.number}.`)
      return
    }
    if (!selection) {
      errors.push(`Choose a class for leg ${index + 1} (${leg.service.number}).`)
      return
    }
    const selectedClass = options.find((option) => option.code === selection.classCode)
    if (!selectedClass) {
      errors.push(`Class ${selection.classCode} is not supported by service ${leg.service.number}.`)
      return
    }
    if (!Number.isSafeInteger(selectedClass.farePaisePerPassenger) || selectedClass.farePaisePerPassenger < 0) {
      errors.push(`Service ${leg.service.number} has an invalid synthetic fare fixture.`)
    }
    if (!selectedClass.seatPreferences.some((preference) => preference.code === selection.preferenceCode)) {
      errors.push(`Seat or berth preference is not available for ${selectedClass.code} on service ${leg.service.number}.`)
    }
  })
  return { valid: errors.length === 0, errors }
}

export function calculateJourneyClassFare(route: JourneyOption, passengerCount: number, selections: JourneyClassSelectionState): JourneyClassFare | null {
  if (!validateJourneyClassSelection(route, passengerCount, selections).valid) return null
  let perPassengerFarePaise = 0
  const legs = route.legs.map((leg, index) => {
    const legKey = journeyLegSelectionKey(route.id, index, leg.service.id)
    const selection: JourneyLegClassSelection = selections[legKey]
    const selectedClass = supportedClassesForLeg(route, index).find((option) => option.code === selection.classCode)!
    perPassengerFarePaise += selectedClass.farePaisePerPassenger
    return { legKey, serviceId: leg.service.id, classCode: selection.classCode, farePaisePerPassenger: selectedClass.farePaisePerPassenger, totalFarePaise: selectedClass.farePaisePerPassenger * passengerCount }
  })
  const totalFarePaise = perPassengerFarePaise * passengerCount
  if (!Number.isSafeInteger(perPassengerFarePaise) || !Number.isSafeInteger(totalFarePaise) || legs.some((leg) => !Number.isSafeInteger(leg.totalFarePaise))) return null
  return { perPassengerFarePaise, totalFarePaise, legs }
}
