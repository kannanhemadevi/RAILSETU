import type { DecisionExplanation, Itinerary, ItineraryDecision, RankingConfiguration, RankingWeights, ScoreFactorExplanation, TransferStatus } from '../types/decision.ts'
import { assessTransfers } from './transferFeasibility.ts'

/** Demo defaults, not empirically validated optimal weights. Weights are percentages and normalized by their sum. */
export const DEFAULT_RANKING_CONFIGURATION: Readonly<RankingConfiguration> = Object.freeze({
  weights: Object.freeze({ arrivalTimeRisk: 30, connectionRisk: 30, fare: 20, confirmationUncertainty: 10, accessibilityPreference: 10 }),
})

const factors: (keyof RankingWeights)[] = ['arrivalTimeRisk', 'connectionRisk', 'fare', 'confirmationUncertainty', 'accessibilityPreference']

function validateConfiguration(configuration: RankingConfiguration): number {
  const weights = factors.map((factor) => configuration.weights[factor])
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  if (weights.some((weight) => !Number.isFinite(weight) || weight < 0) || !Number.isFinite(total) || total <= 0) {
    throw new Error('Ranking weights must be finite, non-negative, and have a positive finite total.')
  }
  return total
}

function hardConstraintExplanations(itinerary: Itinerary): DecisionExplanation[] {
  const explanations: DecisionExplanation[] = []
  if (itinerary.legs.length === 0) {
    explanations.push({ code: 'NO_LEGS', status: 'infeasible', message: 'An itinerary must contain at least one train leg.' })
    return explanations
  }
  if (itinerary.legs.length > 3) explanations.push({ code: 'TOO_MANY_TRANSFERS', status: 'infeasible', message: 'The demo decision engine supports at most two transfers.' })
  const durationMinutes = (new Date(itinerary.legs.at(-1)!.scheduledArrivalAt).getTime() - new Date(itinerary.legs[0].scheduledDepartureAt).getTime()) / 60000
  const transferCount = itinerary.legs.length - 1
  const supportedAccessibility = new Set(itinerary.accessibilityFeatures ?? [])
  for (const passenger of itinerary.passengers) {
    if (passenger.maximumTransfers !== undefined && (!Number.isInteger(passenger.maximumTransfers) || passenger.maximumTransfers < 0)) {
      explanations.push({ code: 'INVALID_PASSENGER_TRANSFER_LIMIT', status: 'infeasible', message: `Passenger ${passenger.id} has an invalid transfer limit.` })
    }
    if (passenger.maximumJourneyMinutes !== undefined && (!Number.isFinite(passenger.maximumJourneyMinutes) || passenger.maximumJourneyMinutes < 0)) {
      explanations.push({ code: 'INVALID_PASSENGER_DURATION_LIMIT', status: 'infeasible', message: `Passenger ${passenger.id} has an invalid journey-duration limit.` })
    }
    if (passenger.maximumFarePaise !== undefined && !isValidFare(passenger.maximumFarePaise)) {
      explanations.push({ code: 'INVALID_PASSENGER_FARE_LIMIT', status: 'infeasible', message: `Passenger ${passenger.id} has an invalid maximum fare constraint.` })
    }
    for (const feature of passenger.mandatoryAccessibilityFeatures ?? []) {
      if (!supportedAccessibility.has(feature)) explanations.push({ code: 'MANDATORY_ACCESSIBILITY_UNAVAILABLE', status: 'infeasible', message: `Passenger ${passenger.id} requires accessibility feature “${feature}”, which this itinerary does not list.` })
    }
    if (passenger.maximumTransfers !== undefined && transferCount > passenger.maximumTransfers) {
      explanations.push({ code: 'PASSENGER_TRANSFER_LIMIT', status: 'infeasible', message: `Itinerary has ${transferCount} transfers, above passenger ${passenger.id}’s maximum of ${passenger.maximumTransfers}.` })
    }
    if (passenger.maximumJourneyMinutes !== undefined && Number.isFinite(durationMinutes) && durationMinutes > passenger.maximumJourneyMinutes) {
      explanations.push({ code: 'PASSENGER_DURATION_LIMIT', status: 'infeasible', message: `Journey duration ${Math.round(durationMinutes)} minutes exceeds passenger ${passenger.id}’s maximum of ${passenger.maximumJourneyMinutes} minutes.` })
    }
    if (passenger.maximumFarePaise !== undefined) {
      const fare = itinerary.scoringFactors?.farePaise
      if (!isValidFare(fare)) explanations.push({ code: 'MANDATORY_FARE_UNKNOWN', status: 'infeasible', message: `A valid synthetic fare is required to check passenger ${passenger.id}’s fare limit.` })
      else if (fare > passenger.maximumFarePaise) explanations.push({ code: 'PASSENGER_FARE_LIMIT', status: 'infeasible', message: `Synthetic fare ${fare} paise exceeds passenger ${passenger.id}’s maximum of ${passenger.maximumFarePaise} paise.` })
    }
  }
  itinerary.legs.forEach((leg, index) => {
    const departure = new Date(leg.scheduledDepartureAt)
    const arrival = new Date(leg.scheduledArrivalAt)
    if (!Number.isFinite(departure.getTime()) || !Number.isFinite(arrival.getTime()) || arrival <= departure) {
      explanations.push({ code: 'INVALID_LEG_TIME', status: 'infeasible', message: `Leg ${leg.id} has invalid or non-positive scheduled travel time.` })
    }
    if ((itinerary.disruptionEvents ?? []).some((event) => event.kind === 'cancellation' && event.affectedLegId === leg.id)) {
      explanations.push({ code: 'LEG_CANCELLED', status: 'infeasible', message: `Leg ${leg.id} is marked cancelled in the synthetic disruption scenario.` })
    }
    const closedStationId = (itinerary.disruptionEvents ?? []).find((event) => event.kind === 'station_closure' && (event.affectedStationId === leg.fromStationId || event.affectedStationId === leg.toStationId))?.affectedStationId
    if (closedStationId) explanations.push({ code: 'STATION_CLOSED', status: 'infeasible', message: `Leg ${leg.id} uses station ${closedStationId}, which is closed in the synthetic disruption scenario.` })
    if (index > 0 && itinerary.legs[index - 1].toStationId !== leg.fromStationId) {
      explanations.push({ code: 'STATION_MISMATCH', status: 'infeasible', message: `Leg ${leg.id} departs from a different station than the previous leg arrives at.` })
    }
  })
  return explanations
}

function isValidScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100
}

function isValidFare(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function getProvidedFactor(itinerary: Itinerary, factor: keyof RankingWeights): unknown {
  const scoring = itinerary.scoringFactors
  if (!scoring) return undefined
  if (factor === 'fare') return scoring.farePaise
  if (factor === 'accessibilityPreference') return scoring.accessibilityPreferenceSatisfaction
  return scoring[factor]
}

function fallbackInput(itinerary: Itinerary, factor: keyof RankingWeights, transfers: ReturnType<typeof assessTransfers>): number | null {
  if (factor === 'connectionRisk') {
    if (!transfers.length) return 0
    return transfers.reduce((sum, transfer) => sum + Math.max(0, Math.min(100, 100 - Math.max(0, transfer.slackMinutes) * 2)), 0) / transfers.length
  }
  if (factor === 'confirmationUncertainty') {
    if (!itinerary.legs.length) return null
    const uncertainty = { confirmed: 0, held: 50, unbooked: 100 }
    return itinerary.legs.reduce((sum, leg) => sum + uncertainty[leg.ticketStatus], 0) / itinerary.legs.length
  }
  if (factor === 'arrivalTimeRisk') {
    const delays = (itinerary.disruptionEvents ?? []).filter((event) => event.kind === 'delay').reduce((sum, event) => sum + Math.max(0, event.delayMinutes ?? 0), 0)
    return delays > 0 ? Math.min(100, delays) : null
  }
  if (factor === 'accessibilityPreference') {
    const preferences = [...new Set(itinerary.passengers.flatMap((passenger) => passenger.optionalAccessibilityFeatures ?? []))]
    if (!preferences.length) return null
    const supported = new Set(itinerary.accessibilityFeatures ?? [])
    return preferences.filter((feature) => supported.has(feature)).length / preferences.length * 100
  }
  return null
}

function normalizedFactorInputs(itinerary: Itinerary, peers: Itinerary[], transfers: ReturnType<typeof assessTransfers>): Record<keyof RankingWeights, { input: number | null; normalized: number; note: string }> {
  const raw = {} as Record<keyof RankingWeights, number | null>
  for (const factor of factors) {
    const provided = getProvidedFactor(itinerary, factor)
    raw[factor] = provided === undefined
      ? fallbackInput(itinerary, factor, transfers)
      : factor === 'fare' ? isValidFare(provided) ? provided : null : isValidScore(provided) ? provided : null
  }
  const validFares = peers.map((peer) => peer.scoringFactors?.farePaise).filter(isValidFare)
  const lowFare = validFares.length ? Math.min(...validFares) : null
  const highFare = validFares.length ? Math.max(...validFares) : null
  const result = {} as ReturnType<typeof normalizedFactorInputs>
  for (const factor of factors) {
    const value = raw[factor]
    const providedValue = getProvidedFactor(itinerary, factor)
    const validProvided = factor === 'fare' ? isValidFare(providedValue) : isValidScore(providedValue)
    const invalidProvided = providedValue !== undefined && !validProvided
    let normalized = 50
    let note = 'Missing or invalid synthetic value; neutral score 50 used.'
    if (factor === 'fare' && isValidFare(value) && lowFare !== null && highFare !== null) {
      normalized = highFare === lowFare ? 100 : (highFare - value) / (highFare - lowFare) * 100
      note = highFare === lowFare ? 'Synthetic fare equals the candidate-set fare; normalized to 100.' : 'Lower synthetic fare scores higher, min–max normalized across feasible candidates.'
    } else if (factor !== 'fare' && value !== null && Number.isFinite(value)) {
      normalized = factor === 'accessibilityPreference' ? value : 100 - value
      note = factor === 'accessibilityPreference' ? 'Optional accessibility preference satisfaction, on a 0–100 scale.' : 'Lower risk/uncertainty scores higher, inverted on a 0–100 scale.'
    }
    if (invalidProvided) note = 'Invalid synthetic value ignored; neutral score 50 used.'
    else if (providedValue === undefined && value === null) note = 'Missing synthetic value; neutral score 50 used.'
    result[factor] = { input: value, normalized, note }
  }
  return result
}

type Assessment = { itinerary: Itinerary; rejectionReasons: DecisionExplanation[]; transferFeasibility: ReturnType<typeof assessTransfers>; status: TransferStatus; explanations: DecisionExplanation[] }

function assessItinerary(itinerary: Itinerary): Assessment {
  const rejectionReasons = hardConstraintExplanations(itinerary)
  const transferFeasibility = assessTransfers(itinerary)
  for (const transfer of transferFeasibility) {
    if (transfer.status === 'infeasible') rejectionReasons.push({ code: 'INFEASIBLE_TRANSFER', status: 'infeasible', message: transfer.explanation })
  }
  const infeasible = rejectionReasons.length > 0
  const status: TransferStatus = infeasible ? 'infeasible' : transferFeasibility.some((transfer) => transfer.status === 'risky') ? 'risky' : 'feasible'
  const explanations: DecisionExplanation[] = transferFeasibility.map((transfer) => ({ code: `TRANSFER_${transfer.status.toUpperCase()}`, status: transfer.status, message: transfer.explanation, details: { fromLegId: transfer.fromLegId, toLegId: transfer.toLegId, remainingConnectionMinutes: transfer.remainingConnectionMinutes, slackMinutes: transfer.slackMinutes, requiredMinutes: transfer.requiredMinutes } }))
  if (!transferFeasibility.length && !infeasible) explanations.push({ code: 'DIRECT_ITINERARY', status: 'feasible' as const, message: 'Direct itinerary has no transfer feasibility check to satisfy.' })
  explanations.push({ code: 'TICKET_STATUS_NOT_FEASIBILITY', status, message: 'Synthetic ticket status does not establish whether itinerary connections are feasible.' })
  return { itinerary, rejectionReasons, transferFeasibility, status, explanations }
}

function decisionFromAssessment(assessment: Assessment, configuration: RankingConfiguration, peers: Itinerary[], weightTotal: number): ItineraryDecision {
  const { itinerary, rejectionReasons, transferFeasibility, status, explanations } = assessment
  const infeasible = rejectionReasons.length > 0
  if (infeasible) {
    return { itineraryId: itinerary.id, status, accepted: false, score: null, rank: null, rejectionReasons, scoreExplanations: [], rankingExplanation: `Rejected: ${rejectionReasons.map((reason) => reason.message).join(' ')}`, tieBreakers: getTieBreakers(itinerary, transferFeasibility), transferFeasibility, explanations }
  }

  const inputs = normalizedFactorInputs(itinerary, peers, transferFeasibility)
  const scoreExplanations: ScoreFactorExplanation[] = factors.map((factor) => {
    const weight = configuration.weights[factor]
    const normalizedScore = inputs[factor].normalized
    return { factor, inputValue: inputs[factor].input, normalizedScore, weight, weightedContribution: normalizedScore * weight / weightTotal, explanation: inputs[factor].note }
  })
  const score = Math.round(scoreExplanations.reduce((sum, factor) => sum + factor.weightedContribution, 0) * 100) / 100
  return { itineraryId: itinerary.id, status, accepted: true, score, rank: null, rejectionReasons: [], scoreExplanations, rankingExplanation: '', tieBreakers: getTieBreakers(itinerary, transferFeasibility), transferFeasibility, explanations }
}

function getTieBreakers(itinerary: Itinerary, transfers: ReturnType<typeof assessTransfers>) {
  const connectionRisk = isValidScore(itinerary.scoringFactors?.connectionRisk)
    ? itinerary.scoringFactors.connectionRisk
    : fallbackInput(itinerary, 'connectionRisk', transfers) ?? 50
  const durationMinutes = (new Date(itinerary.legs.at(-1)?.scheduledArrivalAt ?? Number.NaN).getTime() - new Date(itinerary.legs[0]?.scheduledDepartureAt ?? Number.NaN).getTime()) / 60000
  return { connectionRisk, transfers: Math.max(0, itinerary.legs.length - 1), durationMinutes: Number.isFinite(durationMinutes) ? durationMinutes : Number.MAX_SAFE_INTEGER, farePaise: isValidFare(itinerary.scoringFactors?.farePaise) ? itinerary.scoringFactors.farePaise : Number.MAX_SAFE_INTEGER }
}

export function evaluateItinerary(itinerary: Itinerary, configuration: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION, comparisonSet: Itinerary[] = [itinerary]): ItineraryDecision {
  const weightTotal = validateConfiguration(configuration)
  const assessment = assessItinerary(itinerary)
  const acceptedPeers = comparisonSet.filter((peer) => assessItinerary(peer).rejectionReasons.length === 0)
  return decisionFromAssessment(assessment, configuration, acceptedPeers, weightTotal)
}

/** Hard constraints run first. Scores use weighted normalized desirability; ties use connection risk, transfers, duration, fare, then ID. */
export function rankItineraries(itineraries: Itinerary[], configuration: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION): ItineraryDecision[] {
  const weightTotal = validateConfiguration(configuration)
  const ids = itineraries.map((itinerary) => itinerary.id)
  if (new Set(ids).size !== ids.length) throw new Error('Itinerary IDs must be unique for deterministic ranking.')
  const assessments = itineraries.map(assessItinerary)
  const acceptedPeers = assessments.filter((assessment) => assessment.rejectionReasons.length === 0).map((assessment) => assessment.itinerary)
  const decisions = assessments.map((assessment) => decisionFromAssessment(assessment, configuration, acceptedPeers, weightTotal))
  decisions.sort((a, b) => {
    if (a.accepted !== b.accepted) return a.accepted ? -1 : 1
    if (a.score !== b.score) return (b.score ?? -1) - (a.score ?? -1)
    return a.tieBreakers.connectionRisk - b.tieBreakers.connectionRisk
      || a.tieBreakers.transfers - b.tieBreakers.transfers
      || a.tieBreakers.durationMinutes - b.tieBreakers.durationMinutes
      || a.tieBreakers.farePaise - b.tieBreakers.farePaise
      || a.itineraryId.localeCompare(b.itineraryId)
  })
  let acceptedRank = 0
  return decisions.map((decision, index) => {
    if (!decision.accepted) return { ...decision, rankingExplanation: decision.rankingExplanation || `Rejected: ${decision.rejectionReasons.map((reason) => reason.message).join(' ')}` }
    acceptedRank += 1
    const preceding = decisions.slice(0, index).find((candidate) => candidate.accepted)
    let rankingExplanation = `Ranked ${acceptedRank}: highest available score among remaining feasible synthetic itineraries (${decision.score}).`
    if (preceding) {
      const reason = decision.score !== preceding.score
        ? `score ${decision.score} is below ${preceding.score}`
        : `the fixed tie-break order placed ${preceding.itineraryId} ahead`
      rankingExplanation = `Ranked ${acceptedRank}: ${reason}.`
    }
    return { ...decision, rank: acceptedRank, rankingExplanation }
  })
}
