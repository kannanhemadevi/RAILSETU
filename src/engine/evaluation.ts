import { createBaselineSimulation, inject55MinuteDelay, recommendedAlternatives } from './disruptionSimulator.ts'
import type { EvaluationCheck } from '../types/evaluation.ts'

/** Runs fixed, deterministic checks against the same decision and transfer engine used by the UI. */
export function runDecisionEvaluation(): EvaluationCheck[] {
  const passengers = [{ id: 'evaluation-passenger', name: 'Demo evaluator', category: 'adult' as const }]
  const baseline = createBaselineSimulation(passengers)
  const connection = baseline.currentRankings.find((decision) => decision.itineraryId === 'synthetic-connection')
  const baselineFeasible = Boolean(connection?.accepted && connection.transferFeasibility.every((transfer) => transfer.status !== 'infeasible'))
  const delayed = inject55MinuteDelay(baseline)
  const delayedConnection = delayed.currentRankings.find((decision) => decision.itineraryId === 'synthetic-connection')
  const alternatives = recommendedAlternatives(delayed)
  const transfer = delayedConnection?.transferFeasibility[0]
  return [
    { id: 'baseline-transfer', label: 'Baseline connection satisfies the synthetic minimum', passed: baselineFeasible, detail: connection?.transferFeasibility[0]?.explanation ?? 'Baseline connection decision was not generated.' },
    { id: 'delay-rejects-connection', label: '55-minute delay excludes the now-infeasible connection', passed: Boolean(delayedConnection && !delayedConnection.accepted && transfer?.remainingConnectionMinutes === -15), detail: transfer ? `${transfer.remainingConnectionMinutes} minutes remain; ${delayedConnection?.rejectionReasons[0]?.message ?? 'transfer rejected'}` : 'Delayed transfer decision was not generated.' },
    { id: 'alternative-remains', label: 'Feasible alternative is recommended after delay', passed: alternatives.some((decision) => decision.itineraryId === 'synthetic-direct-alternative'), detail: alternatives.map((decision) => decision.itineraryId).join(', ') || 'No feasible alternative was found.' },
    { id: 'simulated-provenance', label: 'Delay event is explicitly marked synthetic', passed: delayed.activeEvents.length === 1 && delayed.activeEvents[0].synthetic === true, detail: delayed.activeEvents[0]?.description ?? 'No synthetic delay event was recorded.' },
  ]
}
