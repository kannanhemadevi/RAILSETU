import type { DemoBooking, DemoPaymentMethod } from '../types/booking.ts'
import type { JourneyClassSelectionState, JourneyOption, Passenger } from '../types/journey.ts'
import type { JourneyClassFare } from './trainSelection.ts'

export type DemoPaymentAttempt = { id: string; method: DemoPaymentMethod; outcome: 'success' | 'failure' }
export type BookingResult = { status: 'success-demo' | 'failed-demo' | 'duplicate-demo'; booking?: DemoBooking; message: string }

/** Local-only idempotent demo checkout. No payment provider or credentials are involved. */
export function finalizeDemoPayment(
  attempt: DemoPaymentAttempt,
  itinerary: JourneyOption,
  passengers: Passenger[],
  classSelections: JourneyClassSelectionState,
  fare: JourneyClassFare,
  existing: DemoBooking[],
  createdAt = '2030-01-07T00:00:00.000Z',
): BookingResult {
  if (attempt.outcome === 'failure') return { status: 'failed-demo', message: 'Simulated payment failed. No demo booking was created.' }
  const duplicate = existing.find((booking) => booking.paymentAttemptId === attempt.id)
  if (duplicate) return { status: 'duplicate-demo', booking: duplicate, message: 'This simulated payment attempt already has a booking.' }
  if (passengers.length < 1 || passengers.length > 5 || !Number.isSafeInteger(fare.totalFarePaise) || fare.totalFarePaise < 0) {
    return { status: 'failed-demo', message: 'Passenger or fare details are invalid; no demo booking was created.' }
  }
  const booking: DemoBooking = {
    reference: 'RAILSETU-DEMO-' + String(existing.length + 1).padStart(5, '0'),
    paymentAttemptId: attempt.id,
    createdAt,
    paymentMethod: attempt.method,
    paymentStatus: 'success-demo',
    itinerary: structuredClone(itinerary),
    passengers: structuredClone(passengers),
    classSelections: structuredClone(classSelections),
    fare: structuredClone(fare),
  }
  return { status: 'success-demo', booking, message: 'Simulated payment succeeded. This is a demo booking reference, not a railway ticket.' }
}
