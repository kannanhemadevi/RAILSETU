export type Station = { id: string; name: string; code: string; city: string }
export type Service = { id: string; number: string; from: string; to: string; depart: string; arrive: string; days: number[]; classLabel: string }
export type Disruption = { id: string; serviceId?: string; stationId?: string; level: 'watch' | 'caution' | 'clear'; title: string; detail: string }
export type Passenger = { id: string; name: string; category: 'Adult' | 'Senior' | 'Child' | 'Accessible' }
export type JourneyRequest = { origin: string; destination: string; date: string; time: string; passengers: number; priorities: { reliability: number; comfort: number; speed: number } }
export type JourneyLeg = { service: Service; from: Station; to: Station; departAt: Date; arriveAt: Date }
export type JourneyOption = { id: string; legs: JourneyLeg[]; departure: Date; arrival: Date; durationMinutes: number; transferCount: number; bufferMinutes: number[]; risk: number; score: number; fare: number; reasons: string[] }
