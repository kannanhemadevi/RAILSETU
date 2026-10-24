import type { Itinerary, PassengerProfile, RefundRecord } from '../types/decision.ts'
import { services } from './railway.ts'

const service = (id: string) => {
  const found = services.find((item) => item.id === id)
  if (!found) throw new Error(`Missing synthetic service fixture: ${id}`)
  return found
}

function trainLeg(serviceId: string, id: string, day: string) {
  const timetable = service(serviceId)
  return {
    id,
    serviceId,
    fromStationId: timetable.from,
    toStationId: timetable.to,
    scheduledDepartureAt: `${day}T${timetable.depart}:00.000Z`,
    scheduledArrivalAt: `${day}T${timetable.arrive}:00.000Z`,
    ticketStatus: 'confirmed' as const,
  }
}

export function createDisruptionDemoItineraries(passengers: PassengerProfile[]): Itinerary[] {
  const demoDay = '2030-01-07'
  return [
    {
      id: 'synthetic-connection',
      legs: [trainLeg('s1', 'sim-feeder', demoDay), trainLeg('s2', 'sim-connection', demoDay)],
      passengers,
      disruptionEvents: [],
      refundRecords: [],
    },
    {
      id: 'synthetic-direct-alternative',
      legs: [trainLeg('s3', 'sim-direct', demoDay)],
      passengers,
      disruptionEvents: [],
      refundRecords: [],
    },
  ]
}

export const syntheticRefundLedger: RefundRecord[] = [
  { id: 'demo-ledger-1', itineraryId: 'past-demo-trip', passengerId: 'demo-passenger', amountPaise: 12500, currency: 'INR', status: 'requested', reason: 'Unrelated synthetic ledger example', recordedAt: '2030-01-06T12:00:00.000Z', synthetic: true },
]
