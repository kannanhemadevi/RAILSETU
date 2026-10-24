export type PassengerProfile = {
  id: string
  category: 'adult' | 'senior' | 'child' | 'accessible'
  name?: string
  mandatoryAccessibilityFeatures?: string[]
  optionalAccessibilityFeatures?: string[]
  maximumFarePaise?: number
  maximumJourneyMinutes?: number
  maximumTransfers?: number
}

export type CaregiverConstraint = {
  caregiverPassengerId: string
  dependentPassengerIds: string[]
  minimumTransferMinutes: number
}

export type TrainLeg = {
  id: string
  serviceId: string
  fromStationId: string
  toStationId: string
  scheduledDepartureAt: string
  scheduledArrivalAt: string
  ticketStatus: 'confirmed' | 'held' | 'unbooked'
}

export type DisruptionEvent = {
  id: string
  kind: 'delay' | 'cancellation' | 'station_closure' | 'crowding'
  affectedLegId?: string
  affectedStationId?: string
  delayMinutes?: number
  severity: 'low' | 'moderate' | 'high'
  description: string
  synthetic: true
}

export type RefundRecord = {
  id: string
  itineraryId: string
  passengerId: string
  amountPaise: number
  currency: string
  status: 'requested' | 'approved' | 'rejected' | 'paid'
  reason: string
  recordedAt: string
  synthetic: true
}

export type Itinerary = {
  id: string
  legs: TrainLeg[]
  passengers: PassengerProfile[]
  caregiverConstraints?: CaregiverConstraint[]
  disruptionEvents?: DisruptionEvent[]
  refundRecords?: RefundRecord[]
  /** Synthetic demo accessibility capabilities; an absent feature is not assumed to be available. */
  accessibilityFeatures?: string[]
  scoringFactors?: ItineraryScoringFactors
}

export type ItineraryScoringFactors = {
  /** Risk inputs are 0–100, with 0 best. Fare is integer paise. */
  arrivalTimeRisk?: number
  connectionRisk?: number
  farePaise?: number
  confirmationUncertainty?: number
  /** Optional preference satisfaction is 0–100, with 100 best. */
  accessibilityPreferenceSatisfaction?: number
  synthetic: true
}

export type TransferStatus = 'feasible' | 'risky' | 'infeasible'

export type TransferFeasibility = {
  fromLegId: string
  toLegId: string
  stationId: string
  scheduledArrivalAt: string
  scheduledDepartureAt: string
  delayMinutes: number
  actualArrivalAt: string
  remainingConnectionMinutes: number
  requiredMinutes: number
  slackMinutes: number
  status: TransferStatus
  explanation: string
}

export type DecisionExplanation = {
  code: string
  status: TransferStatus
  message: string
  details?: Record<string, string | number | boolean>
}

export type RankingWeights = {
  arrivalTimeRisk: number
  connectionRisk: number
  fare: number
  confirmationUncertainty: number
  accessibilityPreference: number
}

export type RankingConfiguration = {
  /** Illustrative normalized weights; these demo defaults are not validated optimal weights. */
  weights: RankingWeights
}

export type DecisionWeights = RankingWeights

export type ScoreFactorExplanation = {
  factor: keyof RankingWeights
  inputValue: number | null
  normalizedScore: number
  weight: number
  weightedContribution: number
  explanation: string
}

export type ItineraryDecision = {
  itineraryId: string
  status: TransferStatus
  accepted: boolean
  score: number | null
  rank: number | null
  rejectionReasons: DecisionExplanation[]
  scoreExplanations: ScoreFactorExplanation[]
  rankingExplanation: string
  tieBreakers: { connectionRisk: number; transfers: number; durationMinutes: number; farePaise: number }
  transferFeasibility: TransferFeasibility[]
  explanations: DecisionExplanation[]
}
