export type PassengerProfile = {
  id: string
  category: 'adult' | 'senior' | 'child' | 'accessible'
  name?: string
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

export type DecisionWeights = {
  reliability: number
  duration: number
  fewerTransfers: number
  transferSlack: number
}

export type ItineraryDecision = {
  itineraryId: string
  status: TransferStatus
  score: number | null
  transferFeasibility: TransferFeasibility[]
  explanations: DecisionExplanation[]
}
