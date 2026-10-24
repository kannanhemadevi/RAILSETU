import type { DecisionExplanation, DecisionWeights, Itinerary, ItineraryDecision, TransferStatus } from '../types/decision.ts'
import { assessTransfers } from './transferFeasibility.ts'

export const DEFAULT_DECISION_WEIGHTS: Readonly<DecisionWeights> = Object.freeze({
  reliability: 0.45,
  duration: 0.25,
  fewerTransfers: 0.2,
  transferSlack: 0.1,
})

function hardConstraintExplanations(itinerary: Itinerary): DecisionExplanation[] {
  const explanations: DecisionExplanation[] = []
  if (itinerary.legs.length === 0) {
    explanations.push({ code: 'NO_LEGS', status: 'infeasible', message: 'An itinerary must contain at least one train leg.' })
    return explanations
  }
  if (itinerary.legs.length > 3) explanations.push({ code: 'TOO_MANY_TRANSFERS', status: 'infeasible', message: 'The demo decision engine supports at most two transfers.' })
  itinerary.legs.forEach((leg, index) => {
    const departure = new Date(leg.scheduledDepartureAt)
    const arrival = new Date(leg.scheduledArrivalAt)
    if (!Number.isFinite(departure.getTime()) || !Number.isFinite(arrival.getTime()) || arrival <= departure) {
      explanations.push({ code: 'INVALID_LEG_TIME', status: 'infeasible', message: `Leg ${leg.id} has invalid or non-positive scheduled travel time.` })
    }
    const canceled = (itinerary.disruptionEvents ?? []).some((event) => event.kind === 'cancellation' && event.affectedLegId === leg.id)
    if (canceled) explanations.push({ code: 'LEG_CANCELLED', status: 'infeasible', message: `Leg ${leg.id} is marked cancelled in the synthetic disruption scenario.` })
    const closedStationId = (itinerary.disruptionEvents ?? []).find((event) => event.kind === 'station_closure' && (event.affectedStationId === leg.fromStationId || event.affectedStationId === leg.toStationId))?.affectedStationId
    if (closedStationId) explanations.push({ code: 'STATION_CLOSED', status: 'infeasible', message: `Leg ${leg.id} uses station ${closedStationId}, which is closed in the synthetic disruption scenario.` })
    if (index > 0 && itinerary.legs[index - 1].toStationId !== leg.fromStationId) {
      explanations.push({ code: 'STATION_MISMATCH', status: 'infeasible', message: `Leg ${leg.id} departs from a different station than the previous leg arrives at.` })
    }
  })
  return explanations
}

function scoreFeasibleItinerary(itinerary: Itinerary, weights: DecisionWeights): number {
  const durationMinutes = (new Date(itinerary.legs.at(-1)!.scheduledArrivalAt).getTime() - new Date(itinerary.legs[0].scheduledDepartureAt).getTime()) / 60000
  const transfers = Math.max(0, itinerary.legs.length - 1)
  const transferResults = assessTransfers(itinerary)
  const averageSlack = transferResults.length ? transferResults.reduce((sum, transfer) => sum + Math.max(0, transfer.slackMinutes), 0) / transferResults.length : 60
  const disruptionPenalty = (itinerary.disruptionEvents ?? []).reduce((sum, event) => sum + (event.kind === 'delay' ? Math.max(0, event.delayMinutes ?? 0) * 0.8 : event.severity === 'high' ? 25 : event.severity === 'moderate' ? 12 : 5), 0)
  const reliability = Math.max(0, 100 - disruptionPenalty - transferResults.filter((transfer) => transfer.status === 'risky').length * 15)
  const durationScore = Math.max(0, 100 - durationMinutes / 10)
  const transferScore = Math.max(0, 100 - transfers * 30)
  const slackScore = Math.min(100, averageSlack)
  const totalWeight = weights.reliability + weights.duration + weights.fewerTransfers + weights.transferSlack
  return Math.round((reliability * weights.reliability + durationScore * weights.duration + transferScore * weights.fewerTransfers + slackScore * weights.transferSlack) / totalWeight * 100) / 100
}

export function evaluateItinerary(itinerary: Itinerary, weights: DecisionWeights = DEFAULT_DECISION_WEIGHTS): ItineraryDecision {
  const weightValues = Object.values(weights)
  if (weightValues.some((weight) => !Number.isFinite(weight) || weight < 0) || weightValues.every((weight) => weight === 0)) {
    throw new Error('Decision weights must be finite, non-negative, and at least one must be greater than zero.')
  }
  const explanations = hardConstraintExplanations(itinerary)
  const transferFeasibility = assessTransfers(itinerary)
  for (const transfer of transferFeasibility) {
    explanations.push({ code: `TRANSFER_${transfer.status.toUpperCase()}`, status: transfer.status, message: transfer.explanation, details: { fromLegId: transfer.fromLegId, toLegId: transfer.toLegId, slackMinutes: transfer.slackMinutes, requiredMinutes: transfer.requiredMinutes } })
  }
  const infeasible = explanations.some((explanation) => explanation.status === 'infeasible')
  const status: TransferStatus = infeasible ? 'infeasible' : transferFeasibility.some((transfer) => transfer.status === 'risky') ? 'risky' : 'feasible'
  explanations.push({ code: 'TICKET_STATUS_NOT_FEASIBILITY', status, message: 'Ticket confirmation does not establish that the itinerary connections are feasible.' })
  if (!infeasible && !transferFeasibility.length) explanations.push({ code: 'DIRECT_ITINERARY', status: 'feasible', message: 'Direct itinerary has no transfer feasibility check to satisfy.' })
  return { itineraryId: itinerary.id, status, score: infeasible ? null : scoreFeasibleItinerary(itinerary, weights), transferFeasibility, explanations }
}

/** Rank only after hard constraints are evaluated. Ties break by arrival, transfers, then itinerary ID. */
export function rankItineraries(itineraries: Itinerary[], weights: DecisionWeights = DEFAULT_DECISION_WEIGHTS): ItineraryDecision[] {
  const byId = new Map(itineraries.map((itinerary) => [itinerary.id, itinerary]))
  return itineraries.map((itinerary) => evaluateItinerary(itinerary, weights)).sort((a, b) => {
    const aFeasible = a.status !== 'infeasible'
    const bFeasible = b.status !== 'infeasible'
    if (aFeasible !== bFeasible) return aFeasible ? -1 : 1
    if (a.score !== b.score) return (b.score ?? -1) - (a.score ?? -1)
    const aItinerary = byId.get(a.itineraryId)!
    const bItinerary = byId.get(b.itineraryId)!
    const aArrival = new Date(aItinerary.legs.at(-1)?.scheduledArrivalAt ?? 0).getTime()
    const bArrival = new Date(bItinerary.legs.at(-1)?.scheduledArrivalAt ?? 0).getTime()
    const arrivalDifference = (Number.isFinite(aArrival) ? aArrival : Number.MAX_SAFE_INTEGER) - (Number.isFinite(bArrival) ? bArrival : Number.MAX_SAFE_INTEGER)
    if (arrivalDifference !== 0) return arrivalDifference
    const transferDifference = aItinerary.legs.length - bItinerary.legs.length
    return transferDifference || a.itineraryId.localeCompare(b.itineraryId)
  })
}
