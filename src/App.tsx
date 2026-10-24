import { useMemo, useState } from 'react'
import { stations } from './data/railway'
import { planJourney } from './engine/planJourney'
import { normalizeJourneyPreferences, resolveJourneyPreferences } from './engine/preferences'
import type { JourneyOption, Passenger } from './types/journey'
import { RouteCard } from './components/RouteCard'
import { DisruptionSimulator } from './components/DisruptionSimulator'
import { PassengerLedger } from './components/PassengerLedger'
import type { PassengerProfile } from './types/decision'
import './App.css'

const today = (() => { const date = new Date(); const offset = date.getTimezoneOffset(); return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10) })()
const newPassenger = (index: number): Passenger => ({ id: crypto.randomUUID(), name: `Passenger ${index}`, category: 'Adult' })

function App() {
  const [origin, setOrigin] = useState('NDLS')
  const [destination, setDestination] = useState('JP')
  const [date, setDate] = useState(today)
  const [time, setTime] = useState('06:00')
  const [reliability, setReliability] = useState(55)
  const [comfort, setComfort] = useState(25)
  const [speed, setSpeed] = useState(20)
  const [passengers, setPassengers] = useState<Passenger[]>([newPassenger(1)])
  const [results, setResults] = useState<JourneyOption[] | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [error, setError] = useState('')
  const [searched, setSearched] = useState(false)
  const selected = results?.find((route) => route.id === selectedId) ?? results?.[0]
  const totalWeight = reliability + comfort + speed
  const effectiveWeights = useMemo(() => resolveJourneyPreferences({ reliability, comfort, speed }), [reliability, comfort, speed])
  const normalized = useMemo(() => normalizeJourneyPreferences({ reliability, comfort, speed }), [reliability, comfort, speed])
  const decisionPassengers = useMemo<PassengerProfile[]>(() => passengers.map((person) => ({ id: person.id, name: person.name, category: person.category.toLowerCase() as PassengerProfile['category'] })), [passengers])

  function search() {
    setSearched(true)
    if (!stations.some((station) => station.id === origin) || !stations.some((station) => station.id === destination)) { setResults(null); setError('Choose a valid origin and destination station from the station lists.'); return }
    if (origin === destination) { setResults(null); setError('Choose two different stations to plan a journey.'); return }
    if (!date || !time || date < today) { setResults(null); setError('Choose a valid travel date and departure time.'); return }
    setError('')
    const found = planJourney({ origin, destination, date, time, passengers: passengers.length, priorities: effectiveWeights })
    setResults(found)
    setSelectedId(found[0]?.id ?? '')
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
            <div><span className="section-index">WHY THIS MATCH</span><div className="reasons">{selected.reasons.map((reason) => <span key={reason}>✓ &nbsp;{reason}</span>)}</div></div>
            <div className="detail-meta"><span>{selected.transferCount ? `${selected.transferCount} transfer${selected.transferCount > 1 ? 's' : ''}` : 'Direct route'}</span><span>{selected.bufferMinutes.length ? `Connection ${selected.bufferMinutes.join(' / ')} min` : 'No connections'}</span><span>Score {selected.score}/100</span></div>
          </div>}
        </> : <div className="empty-state"><div className="empty-symbol">↗</div><strong>{error ? 'Check your journey details' : 'No matching routes found'}</strong><p>{error || 'Try a different station pair or an earlier departure. This demo includes a limited set of synthetic journeys.'}</p></div>}
      </section>}

      <section className="lab section-card" id="lab">
        <div className="section-heading"><div><span className="section-index">02 / COMPARE</span><h2>Risk-aware Route Lab</h2><p>Your priorities shape how we rank each route.</p></div><span className="lab-icon">⌁</span></div>
        <div className="lab-grid">
          <div className="preferences">
            <Preference label="Reliability" detail="Fewer simulated disruption risks" value={reliability} onChange={setReliability} icon="◉" color="teal" />
            <Preference label="Comfort" detail="More breathing room between connections" value={comfort} onChange={setComfort} icon="⌁" color="blue" />
            <Preference label="Speed" detail="Get there in less time" value={speed} onChange={setSpeed} icon="↗" color="gold" />
            <div className="weights"><span>YOUR WEIGHTING{totalWeight === 0 ? ' · BALANCED DEFAULT' : ''}</span><div><b>RELIABILITY {Math.round(normalized.reliability)}%</b><b>COMFORT {Math.round(normalized.comfort)}%</b><b>SPEED {Math.round(normalized.speed)}%</b></div></div>
          </div>
          <div className="results-panel"><div className="results-heading"><div><span className="section-index">ROUTE COMPARISON</span><h3>{results?.length ? `${results.length} thoughtful options` : 'Your routes, at a glance'}</h3></div><span className="comparison-tag">↗ COMPARE VIEW</span></div>
            <div className="empty-state"><div className="empty-symbol">⌁</div><strong>{results?.length ? 'Preferences applied' : 'Ready when you are'}</strong><p>{results?.length ? 'Your journey options above are ranked using these weights. Adjust a priority and search again to refresh the comparison.' : 'Set your priorities, then search to compare available synthetic routes.'}</p></div>
          </div>
        </div>
        <div className="demo-disclosure"><span>ⓘ</span> <b>Demo data, clearly marked.</b> All service timings, estimated fares, and risk notes are synthetic examples for this prototype and do not reflect live railway operations.</div>
        <DisruptionSimulator passengers={decisionPassengers} />
      </section>

      <section className="passengers section-card" id="passengers">
        <div className="section-heading"><div><span className="section-index">03 / YOUR GROUP</span><h2>Passenger Management</h2><p>Bring your people along. Manage up to five travellers.</p></div><button className="add-button" disabled={passengers.length >= 5} onClick={() => setPassengers((current) => [...current, newPassenger(current.length + 1)])}>＋ Add passenger</button></div>
        <div className="passenger-list">{passengers.map((person, index) => <div className="passenger-row" key={person.id}><div className="passenger-avatar">{String(index + 1).padStart(2, '0')}</div><label className="passenger-name"><span>PASSENGER NAME</span><input value={person.name} aria-label={`Passenger ${index + 1} name`} onChange={(e) => updatePassenger(person.id, 'name', e.target.value)} /></label><label className="passenger-category"><span>TRAVELLER TYPE</span><select value={person.category} aria-label={`Passenger ${index + 1} type`} onChange={(e) => updatePassenger(person.id, 'category', e.target.value)}>{['Adult', 'Senior', 'Child', 'Accessible'].map((type) => <option key={type}>{type}</option>)}</select></label><button className="remove-button" disabled={passengers.length === 1} aria-label={`Remove passenger ${index + 1}`} onClick={() => setPassengers((current) => current.filter((p) => p.id !== person.id))}>×</button></div>)}</div>
        <div className="passenger-foot"><span>♧ &nbsp; {passengers.length} of 5 travellers</span><span>Passenger details stay in this demo session.</span></div>
        <PassengerLedger passengers={passengers} />
      </section>
      <footer><a className="brand" href="#top"><span className="brand-icon">R</span><span>RAILSETU<small>JOURNEY, WITH CONFIDENCE</small></span></a><p>Built for more resilient journeys. &nbsp;·&nbsp; Synthetic demo data only.</p><a href="#top">Back to top ↑</a></footer>
    </main>
  </div>
}

function Preference({ label, detail, value, onChange, icon, color }: { label: string; detail: string; value: number; onChange: (value: number) => void; icon: string; color: string }) {
  return <div className="preference"><div className={`pref-icon ${color}`}>{icon}</div><div className="pref-content"><div className="pref-title"><b>{label}</b><span>{value}%</span></div><p>{detail}</p><input aria-label={`${label} priority`} type="range" min="0" max="100" value={value} onChange={(e) => onChange(Number(e.target.value))} /></div></div>
}

export default App
