import type { ItineraryDecision } from '../types/decision.ts'
import type { JourneyOption } from '../types/journey.ts'

export type RouteInsight =
  | { kind: 'direct'; transferCount: 0; risk: number; recommendation: string }
  | { kind: 'connecting'; transferCount: number; risk: number; recommendation: string; connections: Array<{ stationId: string; scheduledMinutes: number; minimumMinutes?: number; remainingMinutes?: number; status?: 'feasible' | 'risky' | 'infeasible'; reason?: string }> }

/** Presents the existing route and decision-engine outputs; it does not calculate new feasibility. */
export function buildRouteInsight(option: JourneyOption, decision?: ItineraryDecision): RouteInsight {
  if (option.transferCount === 0) return { kind: 'direct', transferCount: 0, risk: option.risk, recommendation: decision?.rankingExplanation ?? option.rankingExplanation ?? '' }
  const connections = option.legs.slice(1).map((leg, index) => {
    const feasibility = decision?.transferFeasibility[index]
    return {
      stationId: leg.from.id,
      scheduledMinutes: option.bufferMinutes[index] ?? 0,
      minimumMinutes: feasibility?.requiredMinutes,
      remainingMinutes: feasibility?.remainingConnectionMinutes,
      status: feasibility?.status,
      reason: feasibility?.explanation,
    }
  })
  return { kind: 'connecting', transferCount: option.transferCount, risk: option.risk, recommendation: decision?.rankingExplanation ?? option.rankingExplanation ?? '', connections }
}
