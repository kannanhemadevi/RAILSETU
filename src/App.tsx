import { useMemo, useState } from 'react'
import { stations } from './data/railway'
import { planJourneyDetailed } from './engine/planJourney'
import { normalizeRankingWeights, resolveRankingWeights } from './engine/preferences'
import type { JourneyRequest, Passenger } from './types/journey'
import { RouteCard } from './components/RouteCard'
import { DisruptionSimulator } from './components/DisruptionSimulator'
import { PassengerLedger } from './components/PassengerLedger'
import { buildJourneyPack, downloadJourneyPack } from './engine/journeyPack'
import { runDecisionEvaluation } from './engine/evaluation'
import type { EvaluationCheck } from './types/evaluation'
import type { PassengerProfile } from './types/decision'
import type { RankingWeights } from './types/decision'
import './App.css'

const today = (() => { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10) })()
const newPassenger = (index: number): Passenger => ({ id: crypto.randomUUID(), name: `Passenger ${index}`, category: 'Adult' })

function App() {
  const [origin, setOrigin] = useState('NDLS')
  const [destination, setDestination] = useState('JP')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('06:00')
  const [optionalAccessibilityPreference, setOptionalAccessibilityPreference] = useState('')
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>({ arrivalTimeRisk: 30, connectionRisk: 30, fare: 20, confirmationUncertainty: 10, accessibilityPreference: 10 })
  const [passengers, setPassengers] = useState<Passenger[]>([newPassenger(1)])
  const [searchRequest, setSearchRequest] = useState<JourneyRequest | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationCheck[] | null>(null)
  const [actionMessage, setActionMessage] = useState('')
  const effectiveWeights = useMemo(() => resolveRankingWeights(rankingWeights), [rankingWeights])
  const normalized = useMemo(() => normalizeRankingWeights(rankingWeights), [rankingWeights])
  const rankingConfiguration = useMemo(() => ({ weights: effectiveWeights }), [effectiveWeights])
  const decisionPassengers = useMemo<PassengerProfile[]>(() => passengers.map((person) => ({ id: person.id, name: person.name, category: person.category.toLowerCase() as PassengerProfile['category'], optionalAccessibilityFeatures: optionalAccessibilityPreference ? [optionalAccessibilityPreference] : [] })), [passengers, optionalAccessibilityPreference])
  const plan = useMemo(() => searchRequest ? planJourneyDetailed({ ...searchRequest, passengerProfiles: decisionPassengers, rankingConfiguration }) : null, [searchRequest, decisionPassengers, rankingConfiguration])
  const results = plan?.options ?? null
  const selected = results?.find((route) => route.id === selectedId) ?? results?.[0]
  const rejectionReason = plan?.decisions.find((decision) => !decision.accepted)?.rejectionReasons[0]?.message

  function search() {
    setSearched(true)
    if (!stations.some((station) => station.id === origin) || !stations.some((station) => station.id === destination)) { setSearchRequest(null); setError('Choose a valid origin and destination station from the station lists.'); return }
    if (origin === destination) { setSearchRequest(null); setError('Choose two different stations to plan a journey.'); return }
    const dateValue = new Date(`${date}T12:00:00`)
    if (!date || !Number.isFinite(dateValue.getTime()) || dateValue.toISOString().slice(0, 10) !== date || date < today || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { setSearchRequest(null); setError('Choose a valid travel date and departure time.'); return }
    if (passengers.length < 1 || passengers.length > 5 || passengers.some((person) => !person.name.trim())) { setSearchRequest(null); setError('Add between one and five passengers, and enter a name for each traveller.'); return }
    setError('')
    setSearchRequest({ origin, destination, date, time, passengers: passengers.length, rankingConfiguration })
    setSelectedId('')
  }

  function updatePassenger(id: string, key: 'name' | 'category', value: string) {
    setPassengers((current) => current.map((person) => person.id === id ? { ...person, [key]: value } as Passenger : person))
  }

  return <div className="app-shell">
    <a className="skip-link" href="#top">Skip to main content</a>
    <header className="topbar"><a className="brand" href="#top"><span className="brand-icon">R</span><span>RAILSETU<small>JOURNEY, WITH CONFIDENCE</small></span></a><nav><a href="#planner">Journey Planner</a><a href="#lab">Route Lab</a><a href="#passengers">Passengers</a></nav><div className="demo-badge"><i /> SYNTHETIC DEMO</div></header>
    <main id="top" tabIndex={-1}>
      <section className="intro"><div className="eyebrow"><span>✳</span> THE RESILIENT RAIL PLANNER</div><h1>Go further.<br /><em>Arrive ready.</em></h1><p>A calmer way to plan what comes next. Compare routes with connection time, travel preferences, and clear context in one place.</p><div className="intro-note"><span>✦</span> Every schedule and disruption shown here is synthetic demo data, not live railway information.</div></section>

      <section className="planner section-card" id="planner">
        <div className="section-heading"><div><span className="section-index">01 / PLAN</span><h2>Journey Planner</h2><p>Start with the journey. We’ll help you see the whole picture.</p></div><span className="step-count">✦ &nbsp;01 — 03</span></div>
        <form className="search-grid" onSubmit={(event) => { event.preventDefault(); search() }}>
          <label className="field field-origin"><span>FROM</span><select value={origin} onChange={(e) => setOrigin(e.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name} · {station.code}</option>)}</select></label>
          <button className="swap" type="button" onClick={() => { setOrigin(destination); setDestination(origin) }} aria-label="Swap origin and destination">⇄</button>
          <label className="field field-destination"><span>TO</span><select value={destination} onChange={(e) => setDestination(e.target.value)}>{stations.map((station) => <option key={station.id} value={station.id}>{station.name} · {station.code}</option>)}</select></label>
          <label className="field field-date"><span>TRAVEL DATE</span><input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label className="field field-time"><span>DEPART AFTER</span><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></label>
          <button className="search-button" type="submit">Find my routes <span>↗</span></button>
        </form>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="helper-row"><span>◷ &nbsp; Flexible connections considered</span><span>♧ &nbsp; {passengers.length} passenger{passengers.length !== 1 ? 's' : ''}</span><span className="synthetic">DEMO SCHEDULES · NOT LIVE</span></div>
      </section>

      {searched && <section className="journey-results section-card" aria-live="polite">
        <div className="section-heading"><div><span className="section-index">YOUR JOURNEY OPTIONS</span><h2>{results?.length ? `${results.length} routes to compare` : 'Journey results'}</h2><p>{results?.length ? 'Select a route to see its connection details and recommendation.' : 'Review the message below and adjust your journey details.'}</p></div></div>
        {results && results.length > 0 ? <>
          <div className="route-list result-cards">{results.map((route, i) => <RouteCard key={route.id} option={route} rank={i + 1} selected={selected?.id === route.id} onSelect={() => setSelectedId(route.id)} />)}</div>
          {selected && <div className="detail-strip">
            <div><span className="section-index">WHY THIS MATCH</span><div className="reasons">{selected.reasons.map((reason) => <span key={reason}>✓ &nbsp;{reason}</span>)}</div>
              <details className="journey-explanation"><summary>Full decision explanation and assumptions</summary>
                <p>{selected.rankingExplanation}</p>
                <ul>{(plan?.decisions.find((decision) => decision.itineraryId === selected.id)?.explanations ?? []).map((item, index) => <li key={`${item.code}-${index}`}>{item.status}: {item.message}</li>)}</ul>
                <p>All journey data, scoring factors, fares, and risk estimates are synthetic demo fixtures; no live railway information is used.</p>
              </details>
              <button type="button" className="pack-button" onClick={() => { const decision = plan?.decisions.find((item) => item.itineraryId === selected.id); downloadJourneyPack(buildJourneyPack(selected, passengers, decision), selected.id); setActionMessage('Journey pack downloaded as a synthetic demo itinerary.') }}>Download journey pack</button>
            </div>
            <div className="detail-meta"><span>{selected.transferCount ? `${selected.transferCount} transfer${selected.transferCount > 1 ? 's' : ''}` : 'Direct route'}</span><span>{selected.bufferMinutes.length ? `Connection ${selected.bufferMinutes.join(' / ')} min` : 'No connections'}</span><span>Score {selected.score}/100</span></div>
          </div>}
        </> : <div className="empty-state"><div className="empty-symbol">↗</div><strong>{error ? 'Check your journey details' : 'No matching routes found'}</strong><p>{error || rejectionReason || 'Try a different station pair or an earlier departure. This demo includes a limited set of synthetic journeys.'}</p></div>}
      </section>}

      <section className="lab section-card" id="lab">
        <div className="section-heading"><div><span className="section-index">02 / COMPARE</span><h2>Risk-aware Route Lab</h2><p>Your priorities shape how we rank each route.</p></div><span className="lab-icon">⌁</span></div>
        <div className="lab-grid">
          <div className="preferences">
            <Preference label="Arrival-time risk" detail="Lower risk from synthetic delays" value={rankingWeights.arrivalTimeRisk} onChange={(value) => setRankingWeights((current) => ({ ...current, arrivalTimeRisk: value }))} icon="◷" color="teal" />
            <Preference label="Connection risk" detail="More reliable transfer margins" value={rankingWeights.connectionRisk} onChange={(value) => setRankingWeights((current) => ({ ...current, connectionRisk: value }))} icon="⌁" color="blue" />
            <Preference label="Fare" detail="Prefer lower synthetic demo fares" value={rankingWeights.fare} onChange={(value) => setRankingWeights((current) => ({ ...current, fare: value }))} icon="₹" color="gold" />
            <Preference label="Confirmation uncertainty" detail="No live ticket confirmation is available" value={rankingWeights.confirmationUncertainty} onChange={(value) => setRankingWeights((current) => ({ ...current, confirmationUncertainty: value }))} icon="?" color="blue" />
            <Preference label="Accessibility preference" detail="Optional synthetic features only" value={rankingWeights.accessibilityPreference} onChange={(value) => setRankingWeights((current) => ({ ...current, accessibilityPreference: value }))} icon="♿" color="teal" />
            <label className="access-choice"><span>OPTIONAL ACCESSIBILITY PREFERENCE</span><select value={optionalAccessibilityPreference} onChange={(event) => setOptionalAccessibilityPreference(event.target.value)}><option value="">No optional preference</option><option value="step-free-boarding">Step-free boarding</option><option value="priority-seating">Priority seating</option></select></label>
            <div className="weights"><span>YOUR NORMALIZED WEIGHTING</span><div><b>ARRIVAL {Math.round(normalized.arrivalTimeRisk)}%</b><b>CONNECTION {Math.round(normalized.connectionRisk)}%</b><b>FARE {Math.round(normalized.fare)}%</b><b>CONFIRMATION {Math.round(normalized.confirmationUncertainty)}%</b><b>ACCESSIBILITY {Math.round(normalized.accessibilityPreference)}%</b></div></div>
          </div>
          <div className="results-panel"><div className="results-heading"><div><span className="section-index">ROUTE COMPARISON</span><h3>{results?.length ? `${results.length} thoughtful options` : 'Your routes, at a glance'}</h3></div><span className="comparison-tag">↗ COMPARE VIEW</span></div>
            <div className="empty-state"><div className="empty-symbol">⌁</div><strong>{results?.length ? 'Preferences applied' : 'Ready when you are'}</strong><p>{results?.length ? 'Your journey options above are reranked automatically when you adjust these weights.' : 'Set your priorities, then search to compare available synthetic routes.'}</p></div>
          </div>
        </div>
        <div className="demo-disclosure"><span>ⓘ</span> <b>Demo data, clearly marked.</b> All service timings, estimated fares, and risk notes are synthetic examples for this prototype and do not reflect live railway operations.</div>
        <DisruptionSimulator passengers={decisionPassengers} rankingConfiguration={rankingConfiguration} />
        <div className="evaluation-box"><div><span className="section-index">DETERMINISTIC RULE CHECKS</span><p>Runs fixed synthetic scenarios through the app’s decision and transfer engines. This does not run the automated test suite.</p></div><button type="button" className="pack-button" onClick={() => setEvaluation(runDecisionEvaluation())}>Run evaluation</button>
          {evaluation && <div className="evaluation-results" aria-live="polite"><b>{evaluation.filter((check) => check.passed).length} of {evaluation.length} checks passed</b><ul>{evaluation.map((check) => <li key={check.id}><strong className={check.passed ? 'evaluation-pass' : 'evaluation-fail'}>{check.passed ? 'PASS' : 'FAIL'}</strong> {check.label} — {check.detail}</li>)}</ul></div>}
        </div>
      </section>

      <section className="passengers section-card" id="passengers">
        <div className="section-heading"><div><span className="section-index">03 / YOUR GROUP</span><h2>Passenger Management</h2><p>Bring your people along. Manage up to five travellers.</p></div><button type="button" className="add-button" disabled={passengers.length >= 5} onClick={() => setPassengers((current) => [...current, newPassenger(current.length + 1)])}>＋ Add passenger</button></div>
        <div className="passenger-list">{passengers.map((person, index) => <div className="passenger-row" key={person.id}><div className="passenger-avatar">{String(index + 1).padStart(2, '0')}</div><label className="passenger-name"><span>PASSENGER NAME</span><input value={person.name} aria-label={`Passenger ${index + 1} name`} onChange={(e) => updatePassenger(person.id, 'name', e.target.value)} /></label><label className="passenger-category"><span>TRAVELLER TYPE</span><select value={person.category} aria-label={`Passenger ${index + 1} type`} onChange={(e) => updatePassenger(person.id, 'category', e.target.value)}>{['Adult', 'Senior', 'Child', 'Accessible'].map((type) => <option key={type}>{type}</option>)}</select></label><button type="button" className="remove-button" disabled={passengers.length === 1} aria-label={`Remove passenger ${index + 1}`} onClick={() => setPassengers((current) => current.filter((p) => p.id !== person.id))}>×</button></div>)}</div>
        <div className="passenger-foot"><span>♧ &nbsp; {passengers.length} of 5 travellers</span><span>Passenger details stay in this demo session.</span></div>
        <PassengerLedger passengers={passengers} />
      </section>
      <footer><a className="brand" href="#top"><span className="brand-icon">R</span><span>RAILSETU<small>JOURNEY, WITH CONFIDENCE</small></span></a><p>Built for more resilient journeys. &nbsp;·&nbsp; Synthetic demo data only.</p><a href="#top">Back to top ↑</a></footer>
      {actionMessage && <p className="action-feedback" role="status">{actionMessage}</p>}
    </main>
  </div>
}

function Preference({ label, detail, value, onChange, icon, color }: { label: string; detail: string; value: number; onChange: (value: number) => void; icon: string; color: string }) {
  return <div className="preference"><div className={`pref-icon ${color}`}>{icon}</div><div className="pref-content"><div className="pref-title"><b>{label}</b><span>{value}%</span></div><p>{detail}</p><input aria-label={`${label} priority`} type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} /></div></div>
}

export default App
