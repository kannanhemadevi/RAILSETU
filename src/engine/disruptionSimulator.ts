import { rankItineraries } from './decisionEngine.ts'
import { createDisruptionDemoItineraries, syntheticRefundLedger } from '../data/disruptionScenario.ts'
import type { DisruptionEvent, Itinerary, ItineraryDecision, PassengerProfile, RefundRecord } from '../types/decision.ts'

export type SimulationPhase = 'baseline' | 'delay-injected'
export type SimulationAction = 'inject-55-minute-delay' | 'reset-to-baseline'
export type SimulationHistoryItem = { sequence: number; action: SimulationAction; summary: string }
export type ItineraryChange = { itineraryId: string; beforeStatus: string; afterStatus: string; beforeScore: number | null; afterScore: number | null; beforeRank: number | null; afterRank: number | null; explanation: string }

export type DisruptionSimulationState = {
  phase: SimulationPhase
  passengers: PassengerProfile[]
  refundRecords: RefundRecord[]
  baselineItineraries: Itinerary[]
  currentItineraries: Itinerary[]
  baselineRankings: ItineraryDecision[]
  currentRankings: ItineraryDecision[]
  activeEvents: DisruptionEvent[]
  history: SimulationHistoryItem[]
  changes: ItineraryChange[]
}

function withPassengers(itineraries: Itinerary[], passengers: PassengerProfile[]): Itinerary[] {
  return itineraries.map((itinerary) => ({ ...itinerary, passengers }))
}

export function syncSimulationPassengers(state: DisruptionSimulationState, passengers: PassengerProfile[]): DisruptionSimulationState {
  if (state.passengers === passengers) return state
  const baselineItineraries = withPassengers(state.baselineItineraries, passengers)
  const currentItineraries = baselineItineraries.map((itinerary) => ({
    ...itinerary,
    disruptionEvents: itinerary.id === 'synthetic-connection' ? state.activeEvents : [],
  }))
  const baselineRankings = rankItineraries(baselineItineraries)
  return { ...state, passengers, baselineItineraries, currentItineraries, baselineRankings, currentRankings: rankItineraries(currentItineraries) }
}

function rankOf(rankings: ItineraryDecision[], itineraryId: string): number | null {
  const index = rankings.findIndex((decision) => decision.itineraryId === itineraryId && decision.status !== 'infeasible')
  return index < 0 ? null : index + 1
}

function compareRankings(before: ItineraryDecision[], after: ItineraryDecision[]): ItineraryChange[] {
  return after.map((decision) => {
    const previous = before.find((item) => item.itineraryId === decision.itineraryId)
    const beforeRank = rankOf(before, decision.itineraryId)
    const afterRank = rankOf(after, decision.itineraryId)
    let explanation = 'Feasibility and ranking did not change.'
    if (previous?.status !== decision.status) explanation = `${previous?.status ?? 'unranked'} → ${decision.status}: ${decision.explanations.find((item) => item.status === decision.status)?.message ?? 'decision status changed.'}`
    else if (beforeRank !== afterRank) explanation = `Feasible alternative moved from rank ${beforeRank ?? '—'} to ${afterRank ?? '—'} after reranking.`
    else if (previous?.score !== decision.score) explanation = `Score changed from ${previous?.score ?? '—'} to ${decision.score ?? '—'}.`
    return { itineraryId: decision.itineraryId, beforeStatus: previous?.status ?? 'unranked', afterStatus: decision.status, beforeScore: previous?.score ?? null, afterScore: decision.score, beforeRank, afterRank, explanation }
  })
}

export function createBaselineSimulation(passengers: PassengerProfile[], refundRecords = syntheticRefundLedger): DisruptionSimulationState {
  const baselineItineraries = createDisruptionDemoItineraries(passengers)
  const baselineRankings = rankItineraries(baselineItineraries)
  return { phase: 'baseline', passengers, refundRecords, baselineItineraries, currentItineraries: baselineItineraries, baselineRankings, currentRankings: baselineRankings, activeEvents: [], history: [], changes: [] }
}

export function inject55MinuteDelay(state: DisruptionSimulationState, currentPassengers = state.passengers): DisruptionSimulationState {
  if (state.phase === 'delay-injected') return state
  const event: DisruptionEvent = {
    id: 'synthetic-delay-55', kind: 'delay', affectedLegId: 'sim-feeder', delayMinutes: 55, severity: 'high',
    description: 'Synthetic 55-minute delay on the feeder leg; no live railway feed is used.', synthetic: true,
  }
  const currentItineraries = withPassengers(state.baselineItineraries, currentPassengers).map((itinerary) => ({
    ...itinerary,
    disruptionEvents: itinerary.id === 'synthetic-connection' ? [event] : [],
  }))
  const currentRankings = rankItineraries(currentItineraries)
  return {
    ...state,
    phase: 'delay-injected',
    passengers: currentPassengers,
    currentItineraries,
    currentRankings,
    activeEvents: [event],
    history: [...state.history, { sequence: state.history.length + 1, action: 'inject-55-minute-delay', summary: 'Injected one synthetic 55-minute feeder delay and recomputed feasibility and ranking.' }],
    changes: compareRankings(state.currentRankings, currentRankings),
  }
}

export function resetSimulation(state: DisruptionSimulationState, currentPassengers = state.passengers): DisruptionSimulationState {
  if (state.phase === 'baseline') return state
  const currentItineraries = withPassengers(state.baselineItineraries, currentPassengers)
  const currentRankings = rankItineraries(currentItineraries)
  return {
    ...state,
    phase: 'baseline',
    passengers: currentPassengers,
    currentItineraries,
    currentRankings,
    activeEvents: [],
    history: [...state.history, { sequence: state.history.length + 1, action: 'reset-to-baseline', summary: 'Removed the synthetic delay and restored baseline feasibility and ranking.' }],
    changes: compareRankings(state.currentRankings, currentRankings),
  }
}

export function hasValidAlternative(state: DisruptionSimulationState): boolean {
  return recommendedAlternatives(state).length > 0
}

export function recommendedAlternatives(state: DisruptionSimulationState): ItineraryDecision[] {
  return state.currentRankings.filter((decision) => decision.status !== 'infeasible')
}
