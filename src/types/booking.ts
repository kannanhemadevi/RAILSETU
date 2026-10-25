import type { JourneyClassSelectionState, JourneyOption, Passenger } from './journey.ts'
import type { JourneyClassFare } from '../engine/trainSelection.ts'

export type DemoPaymentMethod = 'demo-upi' | 'demo-card' | 'demo-netbanking'
export type DemoPaymentStatus = 'success-demo' | 'failed-demo'
export type DemoBooking = {
  reference: string
  paymentAttemptId: string
  createdAt: string
  paymentMethod: DemoPaymentMethod
  paymentStatus: DemoPaymentStatus
  itinerary: JourneyOption
  passengers: Passenger[]
  classSelections: JourneyClassSelectionState
  fare: JourneyClassFare
}
