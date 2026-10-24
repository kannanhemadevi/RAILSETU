import { useState } from 'react'
import { createBaselineSimulation, hasValidAlternative, inject55MinuteDelay, recommendedAlternatives, resetSimulation, syncSimulationPassengers } from '../engine/disruptionSimulator.ts'
import type { PassengerProfile } from '../types/decision.ts'

export function DisruptionSimulator({ passengers }: { passengers: PassengerProfile[] }) {
  const [simulationState, setSimulation] = useState(() => createBaselineSimulation(passengers))
  const simulation = syncSimulationPassengers(simulationState, passengers)

  const rankedAlternatives = recommendedAlternatives(simulation)

  return <section className="simulator" aria-labelledby="simulator-title">
    <div className="simulator-heading"><div><span className="section-index">SYNTHETIC SCENARIO</span><h3 id="simulator-title">Disruption Simulator</h3><p>See how a delay changes connection feasibility and alternative rankings.</p></div><span className="sim-status">{simulation.phase === 'baseline' ? 'BASELINE' : '55 MIN DELAY INJECTED'}</span></div>
    <div className="sim-actions"><button type="button" className="inject-button" disabled={simulation.phase === 'delay-injected'} onClick={() => setSimulation((current) => inject55MinuteDelay(syncSimulationPassengers(current, passengers), passengers))}>Inject 55-minute delay</button><button type="button" className="reset-button" disabled={simulation.phase === 'baseline'} onClick={() => setSimulation((current) => resetSimulation(syncSimulationPassengers(current, passengers), passengers))}>Reset to baseline</button></div>
    <p className="sim-disclosure">Synthetic simulation only. This does not use a live railway feed and does not book or cancel tickets.</p>
    {simulation.changes.length > 0 && <div className="sim-changes"><h4>Before and after</h4>{simulation.changes.map((change) => <article className="sim-change" key={change.itineraryId}>
      <div className="sim-change-main"><b>{change.itineraryId === 'synthetic-connection' ? 'Connecting option' : 'Direct alternative'}</b><span>{change.beforeStatus} → <strong className={change.afterStatus === 'infeasible' ? 'sim-invalid' : 'sim-valid'}>{change.afterStatus}</strong></span></div>
      <div className="sim-change-meta"><span>Score {change.beforeScore ?? '—'} → {change.afterScore ?? '—'}</span><span>Feasible rank {change.beforeRank ?? '—'} → {change.afterRank ?? '—'}</span></div>
      <p>{change.explanation}</p>
    </article>)}</div>}
    {simulation.phase === 'delay-injected' && <div className="sim-outcome" aria-live="polite">
      {hasValidAlternative(simulation) ? <><h4>Feasible alternatives after the delay</h4><ol>{rankedAlternatives.map((decision) => <li key={decision.itineraryId}><b>{decision.itineraryId === 'synthetic-direct-alternative' ? 'Direct alternative' : 'Connecting option'}</b><span>{decision.status} · score {decision.score}</span></li>)}</ol></> : <p className="sim-no-alternative">No valid alternative exists in this synthetic scenario. The affected connection is marked infeasible.</p>}
      <details className="sim-explanation"><summary>Decision explanations</summary>{simulation.currentRankings.map((decision) => <div key={decision.itineraryId}><b>{decision.itineraryId}</b><ul>{decision.explanations.map((item, index) => <li key={`${item.code}-${index}`}>{item.message}</li>)}</ul></div>)}</details>
    </div>}
    {simulation.history.length > 0 && <div className="sim-history"><span>SIMULATION EVENT SEQUENCE</span>{simulation.history.map((item) => <p key={item.sequence}><b>{String(item.sequence).padStart(2, '0')}</b> {item.summary}</p>)}</div>}
  </section>
}
