import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { stations } from './data/railway.ts'
import { pageFromPath, pagePaths } from './engine/appNavigation.ts'
import { finalizeDemoPayment } from './engine/booking.ts'
import { buildJourneyPack } from './engine/journeyPack.ts'
import { runDecisionEvaluation } from './engine/evaluation.ts'
import { planJourneyDetailed } from './engine/planJourney.ts'
import { evaluateJourneyDelay } from './engine/routeDisruption.ts'
import { normalizeRankingWeights, resolveRankingWeights } from './engine/preferences.ts'
import { calculateJourneyClassFare, journeyLegSelectionKey, supportedClassesForLeg, validateJourneyClassSelection } from './engine/trainSelection.ts'
import { isLanguage, languageDirection, languageOptions, loadLanguagePreference, saveLanguagePreference, translate, translateExistingText, withLanguage } from './i18n.ts'
import type { Language } from './i18n.ts'
import type { DemoBooking, DemoPaymentMethod, DemoPaymentStatus } from './types/booking.ts'
import type { EvaluationCheck } from './types/evaluation.ts'
import type { PassengerProfile, RankingWeights } from './types/decision.ts'
import type { JourneyClassSelectionState, JourneyOption, JourneyRequest, Passenger } from './types/journey.ts'
import { RouteCard } from './components/RouteCard.tsx'
import { StationCombobox } from './components/StationCombobox.tsx'
import { DisruptionSimulator } from './components/DisruptionSimulator.tsx'
import { PassengerLedger } from './components/PassengerLedger.tsx'
import { JourneyGuide } from './components/JourneyGuide.tsx'
import type { AssistantAction, AssistantContext } from './engine/assistant.ts'
import './App.css'

type Page = keyof typeof pagePaths
type AppState = {
  origin: string; destination: string; date: string; time: string; passengers: Passenger[]
  searchRequest: JourneyRequest | null; selectedRouteId: string; chosenRouteId: string
  classSelections: JourneyClassSelectionState; bookingPassengerIds: string[]
  bookings: DemoBooking[]; paymentAttemptId: string; paymentMethod: DemoPaymentMethod
  paymentStatus: DemoPaymentStatus | null; language: Language; textSize: number
  hasSelectedLanguage: boolean
  rankingWeights: RankingWeights; optionalAccessibilityPreference: string
  routeDelayInjected: boolean; routeDelayServiceId: string
}
const STORAGE_KEY = 'railsetu-passenger-demo-v2'
const EMPTY_OPTIONS: JourneyOption[] = []
const defaultWeights: RankingWeights = { arrivalTimeRisk: 30, connectionRisk: 30, fare: 20, confirmationUncertainty: 10, accessibilityPreference: 10 }
const today = (() => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) })()
const firstPassenger: Passenger = { id: 'local-passenger-1', name: 'Passenger 1', category: 'Adult' }
const initialState = (): AppState => ({ origin: 'NDLS', destination: 'JP', date: today, time: '06:00', passengers: [firstPassenger], searchRequest: null, selectedRouteId: '', chosenRouteId: '', classSelections: {}, bookingPassengerIds: [firstPassenger.id], bookings: [], paymentAttemptId: '', paymentMethod: 'demo-upi', paymentStatus: null, language: 'en', hasSelectedLanguage: false, textSize: 0, rankingWeights: defaultWeights, optionalAccessibilityPreference: '', routeDelayInjected: false, routeDelayServiceId: '' })
function restoreBooking(b: DemoBooking): DemoBooking {
  const legs = b.itinerary.legs.map((leg) => ({ ...leg, departAt: new Date(leg.departAt), arriveAt: new Date(leg.arriveAt) }))
  return { ...b, itinerary: { ...b.itinerary, departure: new Date(b.itinerary.departure), arrival: new Date(b.itinerary.arrival), legs } }
}
function loadState(): AppState {
  const fallback = initialState()
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppState> | null
    const preferredLanguage = loadLanguagePreference(localStorage)
    return value ? { ...fallback, ...value, language: preferredLanguage ?? (isLanguage(value.language) ? value.language : fallback.language), hasSelectedLanguage: Boolean(preferredLanguage), passengers: value.passengers?.length ? value.passengers : fallback.passengers, bookings: (value.bookings ?? []).map(restoreBooking) } : { ...fallback, language: preferredLanguage ?? 'en', hasSelectedLanguage: Boolean(preferredLanguage) }
  } catch { return fallback }
}
const clock = (date: Date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const money = (paise: number) => '₹' + Math.floor(paise / 100).toLocaleString('en-IN') + '.' + String(paise % 100).padStart(2, '0')
const duration = (minutes: number) => Math.floor(minutes / 60) + 'h ' + minutes % 60 + 'm'
const VoiceAssistant = lazy(() => import('./components/VoiceAssistant.tsx').then((module) => ({ default: module.VoiceAssistant })))

function assistantNavigation(action: AssistantAction): Page {
  const target: Record<AssistantAction, Page> = { dashboard: 'dashboard', tickets: 'tickets', lab: 'lab', disruption: 'disruption', passengers: 'passengers', ledger: 'ledger', language: 'dashboard' }
  return target[action]
}
function pageLabel(page: Page, language: Language) {
  const labels: Record<Page, Parameters<typeof translate>[1]> = { dashboard: 'planner', results: 'results', review: 'routeReview', classes: 'classTitle', passengerDetails: 'passengerDetails', payment: 'payment', confirmation: 'confirmation', tickets: 'tickets', passengers: 'passengers', ledger: 'ledger', lab: 'lab', disruption: 'disruption', evaluation: 'evaluation' }
  return translate(language, labels[page])
}
function readRefundStatuses(): AssistantContext['refundStatusByPassenger'] {
  try {
    const value = JSON.parse(localStorage.getItem('railsetu-passenger-ledger-v1') ?? 'null') as { records?: Record<string, { refundState?: string; cancellationState?: string }> } | null
    return Object.entries(value?.records ?? {}).map(([passengerId, record]) => ({ passengerId, refundState: record.refundState ?? 'unknown', cancellationState: record.cancellationState ?? 'unknown' }))
  } catch { return [] }
}

function App() {
  const [data, setData] = useState<AppState>(loadState)
  const [page, setPage] = useState<Page>(() => pageFromPath(location.pathname))
  const [error, setError] = useState('')
  const [searching, setSearching] = useState(false)
  const [filter, setFilter] = useState<'all' | 'direct' | 'connecting'>('all')
  const [classError, setClassError] = useState('')
  const [paymentMessage, setPaymentMessage] = useState('')
  const [evaluation, setEvaluation] = useState<EvaluationCheck[] | null>(null)
  const weights = useMemo(() => resolveRankingWeights(data.rankingWeights), [data.rankingWeights])
  const normalized = useMemo(() => normalizeRankingWeights(data.rankingWeights), [data.rankingWeights])
  const configuration = useMemo(() => ({ weights }), [weights])
  const profiles = useMemo<PassengerProfile[]>(() => data.passengers.map((p) => ({ id: p.id, name: p.name, category: p.category.toLowerCase() as PassengerProfile['category'], optionalAccessibilityFeatures: data.optionalAccessibilityPreference ? [data.optionalAccessibilityPreference] : [] })), [data.passengers, data.optionalAccessibilityPreference])
  const plan = useMemo(() => data.searchRequest ? planJourneyDetailed({ ...data.searchRequest, passengerProfiles: profiles, rankingConfiguration: configuration }) : null, [data.searchRequest, profiles, configuration])
  const options = plan?.options ?? EMPTY_OPTIONS
  const chosen = options.find((r) => r.id === data.chosenRouteId)
  const selected = options.find((r) => r.id === data.selectedRouteId) ?? options[0]
  const selectedDecision = plan?.decisions.find((decision) => decision.itineraryId === selected?.id)
  const classCheck = chosen ? validateJourneyClassSelection(chosen, data.passengers.length, data.classSelections) : { valid: false, errors: ['Choose a journey first.'] }
  const fare = chosen ? calculateJourneyClassFare(chosen, data.passengers.length, data.classSelections) : null
  const checkoutPassengers = data.passengers.filter((p) => data.bookingPassengerIds.includes(p.id))
  const delay = useMemo(() => data.routeDelayInjected && data.routeDelayServiceId && plan ? evaluateJourneyDelay(options, data.routeDelayServiceId, profiles, configuration) : null, [data.routeDelayInjected, data.routeDelayServiceId, options, profiles, configuration, plan])
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch { /* local browser persistence is optional */ } }, [data])
  useEffect(() => {
    const pop = () => setPage(pageFromPath(location.pathname))
    addEventListener('popstate', pop)
    return () => removeEventListener('popstate', pop)
  }, [])
  function navigate(next: Page) {
    if (location.pathname !== pagePaths[next]) history.pushState({}, '', pagePaths[next])
    setPage(next); setPaymentMessage('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  function set<K extends keyof AppState>(key: K, value: AppState[K]) { setData((old) => ({ ...old, [key]: value })) }
  async function search() {
    if (!stations.some((s) => s.id === data.origin) || !stations.some((s) => s.id === data.destination)) { setError(translate(data.language,'searchErrorStations')); return }
    if (data.origin === data.destination) { setError(translate(data.language,'searchErrorSame')); return }
    const dateCheck = new Date(data.date + 'T12:00:00')
    if (!data.date || !Number.isFinite(dateCheck.getTime()) || dateCheck.toISOString().slice(0,10) !== data.date || data.date < today || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) { setError(translate(data.language,'searchErrorDate')); return }
    if (!data.passengers.length || data.passengers.length > 5 || data.passengers.some((p) => !p.name.trim())) { setError(translate(data.language,'searchErrorPassengers')); return }
    setError(''); setSearching(true); await new Promise((resolve) => setTimeout(resolve, 80))
    setData((old) => ({ ...old, searchRequest: { origin: old.origin, destination: old.destination, date: old.date, time: old.time, passengers: old.passengers.length, rankingConfiguration: configuration }, selectedRouteId: '', chosenRouteId: '', routeDelayInjected: false, routeDelayServiceId: '', paymentAttemptId: '', paymentStatus: null }))
    setSearching(false); navigate('results')
  }
  function countPassengers(count: number) {
    setData((old) => {
      const people = count <= old.passengers.length ? old.passengers.slice(0,count) : [...old.passengers, ...Array.from({ length: count-old.passengers.length }, (_,i) => ({ id: crypto.randomUUID(), name: 'Passenger ' + (old.passengers.length+i+1), category: 'Adult' as const }))]
      return { ...old, passengers: people, bookingPassengerIds: people.map((p) => p.id) }
    })
  }
  function addPassenger(id: string) {
    const person = data.passengers.find((p) => p.id === id)
    if (!person || data.passengers.length >= 5) return
    const copy = { ...person, id: crypto.randomUUID() }
    setData((old) => ({ ...old, passengers: [...old.passengers, copy], bookingPassengerIds: [...old.bookingPassengerIds, copy.id] }))
  }
  function reviewRoute(id: string) { setData((old) => ({ ...old, chosenRouteId: id, selectedRouteId: id, routeDelayInjected: false, routeDelayServiceId: '', paymentAttemptId: '', paymentStatus: null })); navigate('review') }
  function setClass(route: JourneyOption, index: number, code: string) {
    const leg = route.legs[index]; if (!leg) return
    const option = supportedClassesForLeg(route,index).find((item) => item.code === code)
    if (!option) { setClassError(translate(data.language,'invalidClass')); return }
    const key = journeyLegSelectionKey(route.id,index,leg.service.id)
    const preference = option.seatPreferences.find((item) => item.code === data.classSelections[key]?.preferenceCode) ?? option.seatPreferences.find((item) => item.code === 'none') ?? option.seatPreferences[0]
    setData((old) => ({ ...old, classSelections: { ...old.classSelections, [key]: { classCode: option.code, preferenceCode: preference?.code ?? 'none' } }, paymentAttemptId: '', paymentStatus: null }))
    setClassError('')
  }
  function setPreference(route: JourneyOption,index: number,code: string) {
    const leg=route.legs[index]; if (!leg) return
    const key=journeyLegSelectionKey(route.id,index,leg.service.id)
    setData((old)=>({...old,classSelections:{...old.classSelections,[key]:{...old.classSelections[key],preferenceCode:code}},paymentAttemptId:'',paymentStatus:null}))
  }
  function continuePassenger() {
    if (!chosen || !fare || !classCheck.valid) { setClassError(t('classRequired')); return }
    set('bookingPassengerIds',data.passengers.map((p)=>p.id)); navigate('passengerDetails')
  }
  function continuePayment() {
    if (!chosen || !fare || !classCheck.valid) { navigate('classes'); setClassError(t('classRequired')); return }
    if (!checkoutPassengers.length || checkoutPassengers.some((p)=>!p.name.trim())) { setPaymentMessage(t('selectPassengerHelp')); return }
    setData((old)=>({...old,paymentAttemptId:old.paymentAttemptId||crypto.randomUUID(),paymentStatus:null}))
    navigate('payment')
  }
  function pay(outcome: 'success'|'failure') {
    if (!chosen || !fare || !data.paymentAttemptId) { setPaymentMessage(t('summaryHelp')); return }
    const result=finalizeDemoPayment({id:data.paymentAttemptId,method:data.paymentMethod,outcome},chosen,checkoutPassengers,data.classSelections,fare,data.bookings)
    if (result.status==='failed-demo') { set('paymentStatus','failed-demo'); setPaymentMessage(t('failureMessage')); return }
    if (result.booking && result.status==='success-demo') { setData((old)=>({...old,bookings:[...old.bookings,result.booking!],paymentStatus:'success-demo'})); setPaymentMessage(t('success')); navigate('confirmation'); return }
    if (result.booking) { set('paymentStatus','success-demo'); navigate('confirmation'); return }
    setPaymentMessage(result.message)
  }
  function togglePassenger(id: string) {
    const current=data.bookingPassengerIds
    if (current.includes(id)) set('bookingPassengerIds',current.filter((item)=>item!==id))
    else if (current.length<5) set('bookingPassengerIds',[...current,id])
  }
  function downloadTicket(booking: DemoBooking) {
    const url=URL.createObjectURL(new Blob([ticketContent(booking)],{type:'text/plain;charset=utf-8'}))
    const link=document.createElement('a'); link.href=url; link.download='railsetu-'+booking.reference+'-demo-ticket.txt'; link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function downloadPack() {
    if (!selected) return
    const url=URL.createObjectURL(new Blob([buildJourneyPack(selected,data.passengers,selectedDecision)],{type:'text/markdown;charset=utf-8'}))
    const link=document.createElement('a'); link.href=url; link.download='railsetu-'+selected.id+'-journey-pack.md'; link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  }
  function injectDelay() {
    const id=chosen?.legs[0]?.service.id
    if (id) setData((old)=>({...old,routeDelayInjected:true,routeDelayServiceId:id}))
  }
  const t=(key:Parameters<typeof translate>[1])=>translate(data.language,key)
  const direction = languageDirection(data.language)
  function changeLanguage(language: Language) {
    try { saveLanguagePreference(localStorage, language) } catch { /* session still changes if storage is unavailable */ }
    setError((message) => translateExistingText(data.language, language, message))
    setClassError((message) => translateExistingText(data.language, language, message))
    setPaymentMessage((message) => translateExistingText(data.language, language, message))
    setData((old) => ({ ...withLanguage(old, language), hasSelectedLanguage: true }))
  }
  const booking=data.bookings.find((b)=>b.paymentAttemptId===data.paymentAttemptId)??data.bookings.at(-1)
  const filtered=options.filter((r)=>filter==='all'||(filter==='direct'?r.transferCount===0:r.transferCount>0))
  const currentDecision=(data.routeDelayInjected?delay?.afterDelay:plan?.decisions)?.find((d)=>d.itineraryId===chosen?.id)
  const recs=(delay?.afterDelay??[]).filter((d)=>d.accepted).slice(0,4)
  const assistantRoute = chosen ?? selected
  const assistantDecision = chosen ? currentDecision : selectedDecision
  const assistantContext: AssistantContext = {
    language: data.language,
    page: pageLabel(page, data.language),
    originName: stationName(data.origin),
    destinationName: stationName(data.destination),
    routes: options,
    selectedRoute: assistantRoute,
    selectedDecision: assistantDecision,
    passengerCount: data.passengers.length,
    passengerNames: data.passengers.map((passenger) => passenger.name),
    bookingCount: data.bookings.length,
    latestBookingReference: data.bookings.at(-1)?.reference,
    latestBookingStatus: data.bookings.at(-1)?.paymentStatus,
    paymentAttemptStatus: data.paymentStatus ?? undefined,
    classSelections: data.classSelections,
    refundStatusByPassenger: readRefundStatuses(),
  }
  const nav=<TopNav page={page} t={t} go={navigate} count={data.passengers.length}/>
  let view

  if (page==='dashboard') view=<section className="page-stack"><div className="dashboard-intro"><div><span className="eyebrow">PASSENGER JOURNEY WORKSPACE</span><h1>{t('where')}</h1><p>{t('planSynthetic')}</p></div><img src="/railsetu-logo.jpeg" alt="RAILSETU brand mark"/></div><JourneyGuide step="search" language={data.language}/><SearchPanel data={data} t={t} error={error} searching={searching} set={set} search={search} swap={()=>setData((old)=>({...old,origin:old.destination,destination:old.origin}))} count={countPassengers} add={addPassenger}/>{data.bookings.length>0&&<section className="panel"><h2>{t('recentBookings')} · {data.bookings.length}</h2><button className="button-secondary" onClick={()=>navigate('tickets')}>{t('myTickets')}</button></section>}</section>

  else if (page==='results') view=<section className="page-stack"><Title title={t('results')} description={data.searchRequest?stationName(data.origin)+' → '+stationName(data.destination)+' · '+data.searchRequest.date+' · after '+data.searchRequest.time:'Search to generate synthetic journey options.'} back={()=>navigate('dashboard')} backLabel={t('editSearch')}/><JourneyGuide step="train" language={data.language}/>{!data.searchRequest?<Empty title={t('noSearch')} message={t('noSearchHelp')} action={()=>navigate('dashboard')} actionLabel={t('openPlanner')}/>:options.length===0?<Empty title={t('noRoutes')} message={t('noRoutesHelp')} action={()=>navigate('dashboard')} actionLabel={t('changeSearch')}/>:<><div className="results-toolbar"><div className="filter-tabs">{(['all','direct','connecting'] as const).map((f)=><button key={f} className={filter===f?'active':''} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{t(f)}</button>)}</div><span>{filtered.length} / {options.length} {t('optionsCount')}</span></div><div className="route-list">{filtered.map((route,index)=><RouteCard key={route.id} option={route} rank={index+1} selected={route.id===data.chosenRouteId} onSelect={()=>set('selectedRouteId',route.id)} onChoose={()=>reviewRoute(route.id)} onReview={()=>reviewRoute(route.id)} decision={plan?.decisions.find((item)=>item.itineraryId===route.id)} actionLabel={t('review')} t={t}/>)}</div>{selected&&<Decision route={selected} decision={selectedDecision} download={downloadPack}/>}</>}</section>

  else if (page==='review') view=<section className="page-stack"><Title title={t('routeReview')} description={t('reviewHelp')} back={()=>navigate('results')} backLabel={t('backResults')}/>{!chosen?<Empty title={t('noSelection')} message={t('chooseRoute')} action={()=>navigate('results')} actionLabel={t('viewResults')}/>:<><section className="panel"><div className="panel-heading"><div><span className="eyebrow">SELECTED SYNTHETIC ITINERARY · {chosen.id}</span><h2>{chosen.legs[0]!.from.name} → {chosen.legs.at(-1)!.to.name}</h2><p>{duration(chosen.durationMinutes)} · {chosen.transferCount} transfers · {chosen.legs.map((leg)=>leg.service.id).join(' / ')}</p></div><span className="decision-status">{currentDecision?.status??'feasible'}</span></div>{chosen.transferCount===0?<div className="direct-summary"><b>{t('directJourney')}</b><span>{t('noTransfer')}</span></div>:<div className="transfer-review-list">{chosen.legs.slice(1).map((next,index)=>{const previous=chosen.legs[index]!;const transfer=currentDecision?.transferFeasibility[index];return <article className="transfer-review" key={next.service.id}><h3>Transfer at {next.from.name}</h3><dl><div><dt>Arrive</dt><dd>{clock(previous.arriveAt)}</dd></div><div><dt>Next service</dt><dd>{next.service.id} · {clock(next.departAt)}</dd></div><div><dt>Scheduled window</dt><dd>{chosen.bufferMinutes[index]} min</dd></div><div><dt>Required minimum</dt><dd>{transfer?.requiredMinutes??30} min</dd></div><div><dt>Remaining</dt><dd>{transfer?.remainingConnectionMinutes??chosen.bufferMinutes[index]} min</dd></div><div><dt>Status</dt><dd>{transfer?.status??'feasible'}</dd></div></dl><p>{transfer?.explanation??'Stations match and schedule margin is sufficient.'}</p></article>})}</div>}<Legs route={chosen}/><Decision route={chosen} decision={currentDecision} download={downloadPack}/></section>{chosen.transferCount>0&&<section className="panel"><span className="eyebrow">SYNTHETIC ROUTE SCENARIO</span><h2>Test a 55-minute delay on the first service</h2><p>The shared decision engine rechecks this search’s transfer feasibility and reranks alternatives. This is not a live feed.</p><div className="button-row"><button className="button-danger" disabled={data.routeDelayInjected} onClick={injectDelay}>{t('injectDelay')}</button><button className="button-secondary" disabled={!data.routeDelayInjected} onClick={()=>setData((old)=>({...old,routeDelayInjected:false,routeDelayServiceId:''}))}>{t('reset')}</button></div>{data.routeDelayInjected&&delay&&<div className="scenario-outcome"><p>{data.routeDelayServiceId} delayed · selected itinerary {currentDecision?.status??'not recommended'}</p><h3>{t('alternatives')}</h3>{recs.length?recs.map((decision)=><p key={decision.itineraryId}>{decision.itineraryId} · score {decision.score}{decision.itineraryId!==chosen.id&&<button className="link-button" onClick={()=>setData((old)=>({...old,chosenRouteId:decision.itineraryId,selectedRouteId:decision.itineraryId}))}>Review alternative</button>}</p>):<p className="notice-error">No valid alternative exists after this synthetic delay.</p>}<details><summary>{t('beforeAfter')}</summary>{delay.afterDelay.map((decision)=>{const before=delay.baseline.find((item)=>item.itineraryId===decision.itineraryId);return <p key={decision.itineraryId}>{decision.itineraryId}: {before?.status} → {decision.status}. {decision.transferFeasibility.map((x)=>x.explanation).join(' ')}</p>})}</details></div>}</section>}<div className="button-row"><button className="button-primary" onClick={()=>navigate('classes')}>{t('continueClasses')}</button><button className="button-secondary" onClick={()=>navigate('results')}>{t('chooseAnother')}</button></div></>}</section>

  else if (page==='classes') view=<section className="page-stack"><Title title={t('classTitle')} description={t('classHelp')} back={()=>navigate('review')} backLabel={t('backReview')}/><JourneyGuide step="train" language={data.language}/>{!chosen?<Empty title={t('noRoute')} message={t('chooseRoute')} action={()=>navigate('results')} actionLabel={t('openResults')}/>:<section className="panel"><h2>{chosen.legs[0]!.from.name} → {chosen.legs.at(-1)!.to.name}</h2><p className="synthetic-notice">{t('classNotice')}</p>{chosen.legs.map((leg,index)=>{const key=journeyLegSelectionKey(chosen.id,index,leg.service.id);const choice=data.classSelections[key];const opts=supportedClassesForLeg(chosen,index);const cls=opts.find((item)=>item.code===choice?.classCode);return <section className="class-leg" key={key}><h3>{leg.service.id} · Leg {index+1}</h3><p>{leg.from.name} {clock(leg.departAt)} → {leg.to.name} {clock(leg.arriveAt)}</p><div className="class-grid">{opts.map((option)=><label className={'class-choice '+(choice?.classCode===option.code?'chosen':'')} key={option.code}><input type="radio" name={'class-'+key} checked={choice?.classCode===option.code} onChange={()=>setClass(chosen,index,option.code)}/><b>{option.code} · {option.name}</b><span>{t('demoStatus')}: {option.demoAvailability}</span><small>{option.description}</small><strong>{money(option.farePaisePerPassenger)} {t('perPerson')}</strong><small>{t('group')}: {money(option.farePaisePerPassenger*data.passengers.length)}</small></label>)}</div>{cls&&<label className="field berth-field"><span>SEAT / BERTH PREFERENCE</span><select value={choice?.preferenceCode??'none'} onChange={(event)=>setPreference(chosen,index,event.target.value)}>{cls.seatPreferences.map((item)=><option key={item.code} value={item.code}>{item.label}</option>)}</select></label>}</section>})}{classError&&<p className="notice-error" role="alert">{classError}</p>}<div className="fare-total"><span>{t('estimatedTotal')} · {data.passengers.length} {t('passengerCountLabel')}</span><b>{fare?money(fare.totalFarePaise):'Choose a class per leg'}</b></div><div className="button-row"><button className="button-primary" disabled={!classCheck.valid} onClick={continuePassenger}>{t('classContinue')}</button><button className="button-secondary" onClick={()=>navigate('review')}>Back to review</button></div></section>}</section>

  else if (page==='passengerDetails') view=<section className="page-stack"><Title title={t('passengerDetails')} description={t('passengerDetailsHelp')} back={()=>navigate('classes')} backLabel={t('backClasses')}/><JourneyGuide step="passengers" language={data.language}/>{!chosen||!fare?<Empty title={t('completeSelection')} message={t('classRequired')} action={()=>navigate('classes')} actionLabel={t('returnClasses')}/>:<section className="panel"><h2>{t('selectPassengers')}</h2><div className="profile-checkboxes">{data.passengers.map((person)=><label key={person.id}><input type="checkbox" checked={data.bookingPassengerIds.includes(person.id)} onChange={()=>togglePassenger(person.id)}/><span><b>{person.name}</b><small>{person.category}</small></span></label>)}</div>{(!checkoutPassengers.length||checkoutPassengers.some((p)=>!p.name.trim()))&&<p className="notice-error">Select at least one passenger and complete the names.</p>}<div className="booking-summary"><h3>{t('journeySummary')}</h3><p>{chosen.legs[0]!.from.name} → {chosen.legs.at(-1)!.to.name} · {data.searchRequest?.date}</p><ul>{chosen.legs.map((leg,index)=>{const key=journeyLegSelectionKey(chosen.id,index,leg.service.id);return <li key={leg.service.id}>{leg.service.id} · {data.classSelections[key]?.classCode} · {data.classSelections[key]?.preferenceCode}</li>})}</ul><b>{money(fare.totalFarePaise)} synthetic estimate · {checkoutPassengers.length} selected</b></div>{paymentMessage&&<p className="notice-error">{paymentMessage}</p>}<div className="button-row"><button className="button-primary" disabled={!checkoutPassengers.length} onClick={continuePayment}>{t('continuePayment')}</button><button className="button-secondary" onClick={()=>navigate('classes')}>Back</button></div></section>}</section>

  else if (page==='payment') view=<section className="page-stack"><Title title={t('payment')} description="Local demonstration only: no gateway, bank/card credentials or real charges." back={()=>navigate('passengerDetails')} backLabel="← Back to Passenger Details"/><JourneyGuide step="payment" language={data.language}/>{!chosen||!fare?<Empty title="No complete journey summary" message="Complete route, class and passenger selection first." action={()=>navigate('passengerDetails')} actionLabel="Review passengers"/>:<div className="checkout-layout"><section className="panel"><span className="eyebrow">{t('paymentMethods')}</span><h2>{t('methodOutcome')}</h2><p>{t('noSensitive')}</p><fieldset className="payment-options"><legend>{t('method')}</legend>{([['demo-upi','Demo UPI'],['demo-card','Demo Card'],['demo-netbanking','Demo Net Banking']] as const).map(([method,label])=><label key={method}><input type="radio" name="payment-method" checked={data.paymentMethod===method} onChange={()=>set('paymentMethod',method)}/>{label}</label>)}</fieldset><fieldset className="payment-options"><legend>{t('controlledResult')}</legend><label><input type="radio" name="payment-outcome" checked={data.paymentStatus!=='failed-demo'} onChange={()=>set('paymentStatus',null)}/>{t('simulateSuccess')}</label><label><input type="radio" name="payment-outcome" checked={data.paymentStatus==='failed-demo'} onChange={()=>set('paymentStatus','failed-demo')}/>{t('simulateFailure')}</label></fieldset>{paymentMessage&&<p className={data.paymentStatus==='failed-demo'?'notice-error':'notice-success'} role="status">{paymentMessage}</p>}<div className="button-row"><button className="button-primary" onClick={()=>pay(data.paymentStatus==='failed-demo'?'failure':'success')}>{t('confirm')}</button><button className="button-danger" onClick={()=>pay('failure')}>{t('failed')}</button></div></section><BookingSummary route={chosen} fare={fare.totalFarePaise} passengers={checkoutPassengers} selections={data.classSelections}/></div>}</section>

  else if (page==='confirmation') view=<section className="page-stack"><Title title={t('confirmation')} description={t('confirmationHelp')}/><JourneyGuide step="ticket" language={data.language}/>{!booking?<Empty title={t('noBooking')} message={t('finishPayment')} action={()=>navigate('dashboard')} actionLabel={t('planJourney')}/>:<TicketCard booking={booking} download={()=>downloadTicket(booking)}/>}<div className="button-row"><button className="button-primary" onClick={()=>navigate('tickets')}>Open My Tickets</button><button className="button-secondary" onClick={()=>navigate('dashboard')}>Plan another journey</button></div></section>

  else if (page==='tickets') view=<section className="page-stack"><Title title={t('tickets')} description="Local simulated booking records created in this browser."/><JourneyGuide step="ticket" language={data.language}/>{data.bookings.length?<div className="ticket-list">{[...data.bookings].reverse().map((item)=><TicketCard key={item.reference} booking={item} download={()=>downloadTicket(item)}/>)}</div>:<Empty title={t('noTickets')} message={t('ticketsEmpty')} action={()=>navigate('dashboard')} actionLabel={t('planJourney')}/>}</section>

  else if (page==='passengers') view=<section className="page-stack"><Title title={t('passengers')} description="Manage local profiles for route constraints and demo checkout."/><section className="panel"><div className="panel-heading"><div><span className="eyebrow">LOCAL PROFILES · MAXIMUM FIVE</span><h2>{data.passengers.length} of 5</h2></div><button className="button-primary" disabled={data.passengers.length>=5} onClick={()=>setData((old)=>({...old,passengers:[...old.passengers,{id:crypto.randomUUID(),name:'Passenger '+(old.passengers.length+1),category:'Adult'}]}))}>＋ Add passenger</button></div><div className="saved-passenger-list">{data.passengers.map((person,index)=><div className="saved-passenger" key={person.id}><span className="passenger-number">{String(index+1).padStart(2,'0')}</span><label className="field"><span>PASSENGER NAME</span><input value={person.name} onChange={(event)=>setData((old)=>({...old,passengers:old.passengers.map((p)=>p.id===person.id?{...p,name:event.target.value}:p)}))}/></label><label className="field"><span>TRAVELLER TYPE</span><select value={person.category} onChange={(event)=>setData((old)=>({...old,passengers:old.passengers.map((p)=>p.id===person.id?{...p,category:event.target.value as Passenger['category']}:p)}))}>{['Adult','Senior','Child','Accessible'].map((category)=><option key={category}>{category}</option>)}</select></label><button className="button-secondary" disabled={data.passengers.length<=1} onClick={()=>setData((old)=>({...old,passengers:old.passengers.filter((p)=>p.id!==person.id),bookingPassengerIds:old.bookingPassengerIds.filter((id)=>id!==person.id)}))}>Remove</button></div>)}</div><p className="synthetic-notice">Profiles persist locally in this browser; storage is not secure or server-backed.</p></section></section>

  else if (page==='ledger') view=<section className="page-stack"><Title title={t('ledger')} description="Passenger-specific cancellation and refund transitions; all actions are simulated."/>{data.bookings.length>0&&<section className="panel"><h2>{t('bookingRecords')}</h2>{data.bookings.map((b)=><p key={b.reference}><b>{b.reference}</b> · {b.passengers.map((p)=>p.name+' ('+p.id+')').join(', ')} · {money(b.fare.totalFarePaise)} · {b.paymentStatus}</p>)}</section>}<section className="panel"><PassengerLedger passengers={data.passengers}/></section></section>

  else if (page==='lab') view=<section className="page-stack"><Title title={t('lab')} description="Adjust ranking weights; the current route results are recalculated."/><div className="lab-layout"><section className="panel"><h2>{t('priorities')}</h2>{(['arrivalTimeRisk','connectionRisk','fare','confirmationUncertainty','accessibilityPreference'] as const).map((key)=><label className="preference-control" key={key}><span>{key.replaceAll(/([A-Z])/g,' $1')} <b>{data.rankingWeights[key]}%</b></span><input type="range" min="0" max="100" value={data.rankingWeights[key]} onChange={(event)=>set('rankingWeights',{...data.rankingWeights,[key]:Number(event.target.value)})}/></label>)}<label className="field"><span>OPTIONAL ACCESSIBILITY PREFERENCE</span><select value={data.optionalAccessibilityPreference} onChange={(event)=>set('optionalAccessibilityPreference',event.target.value)}><option value="">No optional preference</option><option value="step-free-boarding">Step-free boarding</option><option value="priority-seating">Priority seating</option></select></label><p className="synthetic-notice">Normalized weights: {Object.entries(normalized).map(([key,value])=>key+' '+Math.round(value)+'%').join(' · ')}. Hard constraints apply before scoring.</p></section><section className="panel"><h2>{t('compare')}</h2>{selected?<RouteTable options={options} selected={selected.id} choose={(id)=>set('selectedRouteId',id)} review={reviewRoute}/>:<Empty title={t('noCompare')} message={t('searchCompare')} action={()=>navigate('dashboard')} actionLabel={t('openPlannerShort')}/>}</section></div></section>

  else if (page==='disruption') view=<section className="page-stack"><Title title={t('disruption')} description="The reproducible synthetic disruption scenario is also available as a separate tool."/><section className="panel"><DisruptionSimulator passengers={profiles} rankingConfiguration={configuration}/></section></section>

  else if (page==='evaluation') view=<section className="page-stack"><Title title={t('evaluation')} description="In-app checks use decision-engine functions; this does not run the test suite."/><section className="panel"><div className="panel-heading"><div><span className="eyebrow">IN-APP RULE CHECKS</span><h2>{t('evalResults')}</h2></div><button className="button-primary" onClick={()=>setEvaluation(runDecisionEvaluation())}>{t('runEvaluation')}</button></div>{evaluation?<EvaluationTable checks={evaluation}/>:<Empty title="Not run yet" message="Run evaluation to see actual pass/fail outputs."/>}<button className="button-secondary" disabled={!selected} onClick={downloadPack}>{t('downloadPack')}</button></section></section>
  else view=<Empty title={t('notFound')} message={t('pageNotFound')} action={()=>navigate('dashboard')} actionLabel={t('goHome')}/>

  if (!data.hasSelectedLanguage) return <LanguageSelection language={data.language} choose={changeLanguage}/>
  return <div className={'app-shell text-size-'+data.textSize} lang={data.language} dir={direction}><a className="skip-link" href="#main-content">{t('skip')}</a><header className="site-header"><a className="brand" href="/" aria-label="RAILSETU home" onClick={(event)=>{event.preventDefault();navigate('dashboard')}}><img src="/railsetu-logo.jpeg" alt="RAILSETU"/></a>{nav}<div className="header-tools"><label className="language-control"><span>{t('language')}</span><select id="language-select" value={data.language} aria-label={t('language')} onChange={(event)=>changeLanguage(event.target.value as Language)}>{languageOptions.map((option)=><option key={option.code} value={option.code}>{option.nativeName} — {option.englishName}</option>)}</select></label><div className="text-size-control" aria-label={t('size')}><button disabled={data.textSize===0} aria-label="Decrease text size" onClick={()=>set('textSize',Math.max(0,data.textSize-1))}>A−</button><button disabled={data.textSize===2} aria-label="Increase text size" onClick={()=>set('textSize',Math.min(2,data.textSize+1))}>A+</button></div></div></header><main id="main-content" className="main-content" tabIndex={-1}><div className="demo-banner"><span className="demo-dot"/>{t('notice')}{data.language!=='en'&&<span className="translation-note">{t('partial')}</span>}</div>{view}<footer className="site-footer"><span>RAILSETU · {t('demo')}</span><span>{t('noLive')}</span></footer></main><Suspense fallback={null}><VoiceAssistant context={assistantContext} onNavigate={(action) => navigate(assistantNavigation(action))} onChangeLanguage={changeLanguage}/></Suspense></div>
}

function LanguageSelection({language,choose}:{language:Language;choose:(language:Language)=>void}) {
  const t=(key:Parameters<typeof translate>[1])=>translate(language,key)
  return <main className="language-screen" lang={language} dir={languageDirection(language)}><section className="language-card"><div className="language-brand"><img src="/railsetu-logo.jpeg" alt="RAILSETU"/></div><span className="eyebrow">RAILSETU · PASSENGER PORTAL</span><h1>{t('chooseLanguage')}</h1><p>{t('languagePrompt')}</p><div className="language-choice-grid">{languageOptions.map((option)=><button key={option.code} type="button" aria-pressed={language===option.code} className={language===option.code?'language-choice selected':'language-choice'} lang={option.code} dir={languageDirection(option.code)} onClick={()=>choose(option.code)}><strong>{option.nativeName}</strong><span>{option.englishName}</span></button>)}</div><p className="language-disclaimer">{translate(language,'demo')}</p></section></main>
}

function TopNav({page,t,go,count}:{page:Page;t:(key:Parameters<typeof translate>[1])=>string;go:(page:Page)=>void;count:number}) {
  const item=(target:Page,label:string)=><a href={pagePaths[target]} aria-current={page===target?'page':undefined} onClick={(event)=>{event.preventDefault();go(target)}}>{label}</a>
  return <><nav className="desktop-nav" aria-label={t('mainNav')}>{item('dashboard',t('home'))}{item('dashboard',t('planner'))}<details className={page==='passengers'?'active':''}><summary>{t('passengers')} ({count})</summary><div className="nav-dropdown"><p>{count} local profiles</p>{item('passengers',t('manageProfiles'))}</div></details><details className={page==='tickets'||page==='ledger'?'active':''}><summary>{t('bookings')}</summary><div className="nav-dropdown">{item('tickets',t('tickets'))}{item('ledger',t('ledger'))}</div></details><details className={['lab','disruption','evaluation'].includes(page)?'active':''}><summary>{t('tools')}</summary><div className="nav-dropdown">{item('lab',t('lab'))}{item('disruption',t('disruption'))}{item('evaluation',t('evaluation'))}</div></details></nav><details className="mobile-navigation"><summary>{t('menu')}</summary><nav aria-label={t('mobileNav')}>{item('dashboard',t('home'))}{item('dashboard',t('planner'))}{item('passengers',t('passengers'))}{item('tickets',t('tickets'))}{item('ledger',t('ledger'))}{item('lab',t('lab'))}{item('disruption',t('disruption'))}{item('evaluation',t('evaluation'))}</nav></details></>
}
function SearchPanel({data,t,error,searching,set,search,swap,count,add}:{data:AppState;t:(key:Parameters<typeof translate>[1])=>string;error:string;searching:boolean;set:<K extends keyof AppState>(key:K,value:AppState[K])=>void;search:()=>void;swap:()=>void;count:(n:number)=>void;add:(id:string)=>void}) {
  return <section className="panel search-panel"><form noValidate onSubmit={(event)=>{event.preventDefault();search()}}><div className="station-fields"><StationCombobox label={t('from')} value={data.origin} onChange={(id)=>set('origin',id)} excludeId={data.destination} language={data.language}/><button type="button" className="swap-control" onClick={swap} aria-label={t('swap')} title={t('swap')}>⇄</button><StationCombobox label={t('to')} value={data.destination} onChange={(id)=>set('destination',id)} excludeId={data.origin} language={data.language}/></div><div className="form-fields"><label className="field"><span>{t('date')}</span><input type="date" min={today} value={data.date} onChange={(event)=>set('date',event.target.value)}/></label><label className="field"><span>{t('time')}</span><input type="time" value={data.time} onChange={(event)=>set('time',event.target.value)}/></label><label className="field"><span>{t('passengerCount')}</span><select value={data.passengers.length} onChange={(event)=>count(Number(event.target.value))}>{[1,2,3,4,5].map((n)=><option key={n}>{n}</option>)}</select></label><label className="field"><span>{t('savedPassenger')}</span><select value="" onChange={(event)=>{if(event.target.value)add(event.target.value)}}><option value="">{t('selectProfile')}</option>{data.passengers.map((person)=><option key={person.id} value={person.id}>{person.name} · {person.category}</option>)}</select></label></div><div className="search-footer"><div><button className="button-primary search-submit" disabled={searching}>{searching?t('searching'):t('search')}</button>{error&&<p className="notice-error" role="alert">{error}</p>}</div></div></form></section>
}
function Title({title,description,back,backLabel}:{title:string;description:string;back?:()=>void;backLabel?:string}){return <div className="page-title">{back&&<button className="back-link" onClick={back}>{backLabel??'← Back'}</button>}<span className="eyebrow">RAILSETU PASSENGER PORTAL</span><h1>{title}</h1><p>{description}</p></div>}
function Empty({title,message,action,actionLabel}:{title:string;message:string;action?:()=>void;actionLabel?:string}){return <div className="empty-state"><strong>{title}</strong><p>{message}</p>{action&&<button className="button-secondary" onClick={action}>{actionLabel??'Continue'}</button>}</div>}
function stationName(id:string){return stations.find((station)=>station.id===id)?.name??id}
function Decision({route,decision,download}:{route:JourneyOption;decision:ReturnType<typeof planJourneyDetailed>['decisions'][number]|undefined;download:()=>void}){return <section className="decision-summary"><div className="panel-heading"><div><span className="eyebrow">WHY THIS ROUTE RANKS HERE</span><h2>Recommendation explanation</h2></div><button className="button-secondary" onClick={download}>Download journey pack</button></div><p>{decision?.rankingExplanation??route.rankingExplanation}</p><div className="decision-factors">{decision?.scoreExplanations.map((factor)=><article key={factor.factor}><b>{factor.factor.replaceAll(/([A-Z])/g,' $1')}</b><span>{factor.normalizedScore}/100 · {factor.weight}% weight</span><small>{factor.explanation}</small></article>)}</div><details><summary>Feasibility and assumptions</summary><ul>{decision?.explanations.map((item,index)=><li key={item.code+index}>{item.status}: {item.message}</li>)}</ul><p>Generated from synthetic schedules and fares only.</p></details></section>}
function Legs({route}:{route:JourneyOption}){return <div className="leg-review-list">{route.legs.map((leg,index)=><div className="leg-review-row" key={leg.service.id}><b>Leg {index+1} · {leg.service.id}</b><span>{leg.from.name} {clock(leg.departAt)} → {leg.to.name} {clock(leg.arriveAt)}</span><span>{duration(Math.round((leg.arriveAt.getTime()-leg.departAt.getTime())/60000))}</span></div>)}</div>}
function RouteTable({options,selected,choose,review}:{options:JourneyOption[];selected:string;choose:(id:string)=>void;review:(id:string)=>void}){return <div className="table-overflow"><table className="route-table"><thead><tr><th>Rank</th><th>Generated service path</th><th>Duration</th><th>Transfers</th><th>Margins</th><th>Risk</th><th>Action</th></tr></thead><tbody>{options.map((route,index)=><tr key={route.id} className={route.id===selected?'selected-row':''}><td>{index+1}</td><th><button className="link-button" onClick={()=>choose(route.id)}>{route.legs.map((leg)=>leg.service.id).join(' → ')}</button><small>{route.legs[0]!.from.name} → {route.legs.at(-1)!.to.name}</small></th><td>{duration(route.durationMinutes)}</td><td>{route.transferCount}</td><td>{route.bufferMinutes.length?route.bufferMinutes.map((n)=>n+'m').join(' / '):'—'}</td><td>{route.risk}/100</td><td><button className="button-small" onClick={()=>review(route.id)}>Review</button></td></tr>)}</tbody></table></div>}
function BookingSummary({route,fare,passengers,selections}:{route:JourneyOption;fare:number;passengers:Passenger[];selections:JourneyClassSelectionState}){return <aside className="panel booking-aside"><span className="eyebrow">SIMULATED CHECKOUT SUMMARY</span><h2>{route.legs[0]!.from.name} → {route.legs.at(-1)!.to.name}</h2><p>{route.legs.map((leg)=>leg.service.id).join(' · ')}</p><p>{route.transferCount} transfers · {duration(route.durationMinutes)}</p><h3>Passengers</h3><ul>{passengers.map((p)=><li key={p.id}>{p.name} · {p.category}</li>)}</ul><h3>Classes per leg</h3><ul>{route.legs.map((leg,index)=>{const key=journeyLegSelectionKey(route.id,index,leg.service.id);return <li key={leg.service.id}>{leg.service.id} · {selections[key]?.classCode} · {selections[key]?.preferenceCode}</li>})}</ul><div className="fare-total"><span>Demo estimated total</span><b>{money(fare)}</b></div></aside>}
function TicketCard({booking,download}:{booking:DemoBooking;download:()=>void}){return <article className="panel ticket-card"><div className="ticket-head"><div><span className="eyebrow">SIMULATED BOOKING · NOT A VALID RAILWAY TICKET</span><h2>{booking.reference}</h2></div><span className="decision-status">{booking.paymentStatus}</span></div><p>Payment method: {booking.paymentMethod} · {new Date(booking.createdAt).toLocaleString()}</p><h3>{booking.itinerary.legs[0]!.from.name} → {booking.itinerary.legs.at(-1)!.to.name}</h3><p>{duration(booking.itinerary.durationMinutes)} · {booking.itinerary.transferCount} transfers · {booking.passengers.length} passengers</p><div className="table-overflow"><table className="route-table"><thead><tr><th>Passenger</th><th>Service</th><th>Class</th><th>Preference</th><th>Estimated fare</th></tr></thead><tbody>{booking.passengers.flatMap((passenger)=>booking.itinerary.legs.map((leg,index)=>{const key=journeyLegSelectionKey(booking.itinerary.id,index,leg.service.id);const choice=booking.classSelections[key];const option=leg.service.syntheticClasses?.find((item)=>item.code===choice?.classCode);return <tr key={passenger.id+leg.service.id}><td>{passenger.name}</td><td>{leg.service.id}<small>{leg.from.name} {clock(leg.departAt)} → {leg.to.name} {clock(leg.arriveAt)}</small></td><td>{option?.code} · {option?.name}</td><td>{option?.seatPreferences.find((x)=>x.code===choice?.preferenceCode)?.label}</td><td>{money(option?.farePaisePerPassenger??0)}</td></tr>}))}</tbody></table></div><div className="fare-total"><span>Simulated payment · no charge</span><b>{money(booking.fare.totalFarePaise)}</b></div><button className="button-primary" onClick={download}>{translate('en','download')}</button><p className="synthetic-notice">This local demo confirmation is not a ticket, does not reserve a seat and cannot be used for travel.</p></article>}
function ticketContent(booking:DemoBooking){const legs=booking.itinerary.legs.map((leg,index)=>{const key=journeyLegSelectionKey(booking.itinerary.id,index,leg.service.id);const choice=booking.classSelections[key];const option=leg.service.syntheticClasses?.find((x)=>x.code===choice?.classCode);return (index+1)+'. '+leg.service.id+' · '+leg.from.name+' '+clock(leg.departAt)+' → '+leg.to.name+' '+clock(leg.arriveAt)+' · '+option?.code+' '+option?.name+' · '+choice?.preferenceCode}).join('\\n');return ['RAILSETU SIMULATED DEMO CONFIRMATION','NOT A VALID INDIAN RAILWAYS TICKET. No seat is reserved and no real payment was taken.','Booking reference: '+booking.reference,'Payment status: '+booking.paymentStatus+' via '+booking.paymentMethod,'Passengers: '+booking.passengers.map((p)=>p.name+' ('+p.category+')').join(', '),'Journey: '+booking.itinerary.legs[0]!.from.name+' → '+booking.itinerary.legs.at(-1)!.to.name,'Estimated demo fare: '+money(booking.fare.totalFarePaise),'Legs and classes:',legs].join('\\n\\n')}
function EvaluationTable({checks}:{checks:EvaluationCheck[]}){return <div className="table-overflow"><p><b>{checks.filter((x)=>x.passed).length} / {checks.length}</b> in-app checks passed</p><table className="route-table"><thead><tr><th>Result</th><th>Rule check</th><th>Observed output</th></tr></thead><tbody>{checks.map((x)=><tr key={x.id}><td className={x.passed?'pass-text':'fail-text'}>{x.passed?'PASS':'FAIL'}</td><th>{x.label}</th><td>{x.detail}</td></tr>)}</tbody></table></div>}

export default App
