import type { CaregiverConstraint, Itinerary, TransferFeasibility, TransferStatus } from '../types/decision.ts'

export const DEFAULT_TRANSFER_REQUIREMENTS: Record<'adult' | 'senior' | 'child' | 'accessible', number> = {
  adult: 25,
  senior: 35,
  child: 30,
  accessible: 40,
}

function requiredTransferMinutes(itinerary: Itinerary): number {
  const passengerRequirement = Math.max(0, ...itinerary.passengers.map((passenger) => DEFAULT_TRANSFER_REQUIREMENTS[passenger.category]))
  const caregiverRequirement = Math.max(0, ...(itinerary.caregiverConstraints ?? []).map((constraint: CaregiverConstraint) => constraint.minimumTransferMinutes))
  return Math.max(passengerRequirement, caregiverRequirement)
}

function delayForLeg(itinerary: Itinerary, legId: string): number {
  return (itinerary.disruptionEvents ?? [])
    .filter((event) => event.kind === 'delay' && event.affectedLegId === legId)
    .reduce((sum, event) => sum + Math.max(0, event.delayMinutes ?? 0), 0)
}

export function assessTransfers(itinerary: Itinerary): TransferFeasibility[] {
  const requiredMinutes = requiredTransferMinutes(itinerary)
  return itinerary.legs.slice(1).map((nextLeg, index) => {
    const previousLeg = itinerary.legs[index]
    const scheduledArrival = new Date(previousLeg.scheduledArrivalAt)
    const scheduledDeparture = new Date(nextLeg.scheduledDepartureAt)
    const delayMinutes = delayForLeg(itinerary, previousLeg.id)
    const actualArrival = new Date(scheduledArrival.getTime() + delayMinutes * 60000)
    const validTimes = Number.isFinite(scheduledArrival.getTime()) && Number.isFinite(scheduledDeparture.getTime())
    const slackMinutes = validTimes ? Math.floor((scheduledDeparture.getTime() - actualArrival.getTime()) / 60000) - requiredMinutes : -Number.MAX_SAFE_INTEGER
    const stationMismatch = previousLeg.toStationId !== nextLeg.fromStationId
    const status: TransferStatus = !validTimes || slackMinutes < 0 || stationMismatch ? 'infeasible' : slackMinutes < 15 ? 'risky' : 'feasible'
    let explanation = `Transfer has ${slackMinutes} minutes beyond the required ${requiredMinutes}-minute minimum.`
    if (!validTimes) explanation = 'The transfer contains an invalid scheduled arrival or departure time.'
    else if (stationMismatch) explanation = 'The arriving leg and departing leg use different stations.'
    else if (slackMinutes < 0) explanation = `Transfer misses the passenger/group minimum by ${Math.abs(slackMinutes)} minutes after disruption delay.`
    else if (status === 'risky') explanation = `Transfer meets the minimum but has only ${slackMinutes} minutes of spare margin.`
    return {
      fromLegId: previousLeg.id,
      toLegId: nextLeg.id,
      stationId: previousLeg.toStationId,
      scheduledArrivalAt: previousLeg.scheduledArrivalAt,
      scheduledDepartureAt: nextLeg.scheduledDepartureAt,
      delayMinutes,
      actualArrivalAt: Number.isFinite(actualArrival.getTime()) ? actualArrival.toISOString() : 'Invalid synthetic time',
      requiredMinutes,
      slackMinutes,
      status,
      explanation,
    }
  })
}
