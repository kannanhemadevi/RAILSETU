import { rankItineraries, DEFAULT_RANKING_CONFIGURATION } from './decisionEngine.ts'
import { toDecisionItinerary } from './planJourney.ts'
import type { JourneyOption } from '../types/journey.ts'
import type { Itinerary, ItineraryDecision, PassengerProfile, RankingConfiguration } from '../types/decision.ts'

export type RouteDelayEvaluation = { baseline: ItineraryDecision[]; afterDelay: ItineraryDecision[]; affectedServiceId: string }

/** Reuses the planner's decision model and shared hard-constraint/ranking engine for a route-review delay. */
export function evaluateJourneyDelay(
  options: JourneyOption[],
  affectedServiceId: string,
  passengers: PassengerProfile[],
  configuration: RankingConfiguration = DEFAULT_RANKING_CONFIGURATION,
  delayMinutes = 55,
): RouteDelayEvaluation {
  const baseline = options.map((option) => toDecisionItinerary(option, passengers))
  const affected: Itinerary[] = baseline.map((itinerary) => {
    const targetLeg = itinerary.legs.find((leg) => leg.serviceId === affectedServiceId)
    if (!targetLeg) return itinerary
    return {
      ...itinerary,
      disruptionEvents: [...(itinerary.disruptionEvents ?? []), {
        id: 'route-review-delay-' + affectedServiceId,
        kind: 'delay',
        affectedLegId: targetLeg.id,
        delayMinutes,
        severity: 'high',
        description: 'Synthetic route-review delay applied to service ' + affectedServiceId + '.',
        synthetic: true,
      }],
      scoringFactors: { ...itinerary.scoringFactors, arrivalTimeRisk: Math.min(100, (itinerary.scoringFactors?.arrivalTimeRisk ?? 0) + delayMinutes), synthetic: true },
    }
  })
  return { baseline: rankItineraries(baseline, configuration), afterDelay: rankItineraries(affected, configuration), affectedServiceId }
}
