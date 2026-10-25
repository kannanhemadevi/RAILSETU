import type { ItineraryDecision, PassengerProfile, RankingConfiguration, ScoreFactorExplanation } from './decision.ts'

export type Station = { id: string; name: string; code: string; city: string; stateOrUT?: string; networkHubId?: string }
export type TrainClassCode = '1A' | '2A' | '3A' | 'SL' | 'CC' | '2S'
export type DemoAvailability = 'available-demo' | 'limited-demo'
export type SeatPreferenceOption = { code: string; label: string; kind: 'berth' | 'seat' | 'none' }
export type SyntheticClassOption = { code: TrainClassCode; name: string; demoAvailability: DemoAvailability; farePaisePerPassenger: number; description: string; seatPreferences: SeatPreferenceOption[] }
export type JourneyLegClassSelection = { classCode: TrainClassCode; preferenceCode: string }
export type JourneyClassSelectionState = Record<string, JourneyLegClassSelection>
export type Service = { id: string; number: string; from: string; to: string; depart: string; arrive: string; days: number[]; classLabel: string; syntheticAccessibilityFeatures?: string[]; syntheticClasses?: SyntheticClassOption[] }
export type Disruption = { id: string; serviceId?: string; stationId?: string; level: 'watch' | 'caution' | 'clear'; title: string; detail: string }
export type MealPreference = 'vegetarian' | 'non-vegetarian' | 'jain' | 'no-meal'
export type CarHelpPreference = 'yes' | 'no'
export type Passenger = {
  id: string
  name: string
  category: 'Adult' | 'Senior' | 'Child' | 'Accessible'
  age?: number
  mealPreference?: MealPreference
  passengerWithDisabilities?: boolean
  carHelpPreference?: CarHelpPreference
  /** Per passenger and itinerary leg. Values are class-specific and demo preferences only. */
  berthPreferences?: Record<string, string>
  berthPreferenceSources?: Record<string, 'automatic' | 'manual'>
}
export type JourneyRequest = { origin: string; destination: string; date: string; time: string; passengers: number; rankingConfiguration?: RankingConfiguration; passengerProfiles?: PassengerProfile[] }
export type JourneyLeg = { service: Service; from: Station; to: Station; departAt: Date; arriveAt: Date }
export type JourneyOption = { id: string; legs: JourneyLeg[]; departure: Date; arrival: Date; durationMinutes: number; transferCount: number; bufferMinutes: number[]; risk: number; score: number; fare: number; reasons: string[]; scoreExplanations?: ScoreFactorExplanation[]; rankingExplanation?: string }
export type JourneyPlanResult = { options: JourneyOption[]; decisions: ItineraryDecision[] }
