import { useState, type FormEvent } from 'react'
import type { MessageKey } from '../i18n.ts'
import { requestTrainTracking, startTracking, type TrackingState } from '../engine/trainTracking.ts'
import './TrainTrackingPanel.css'

export function TrainTrackingPanel({ t }: { t: (key: MessageKey) => string }) {
  const [number, setNumber] = useState('')
  const [state, setState] = useState<TrackingState>({ status: 'idle' })
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const initial = startTracking(number)
    setState(initial)
    if (initial.status !== 'loading') return
    // Keep the accessible progress state visible for this local fixture lookup.
    await new Promise((resolve) => window.setTimeout(resolve, 220))
    setState(await requestTrainTracking(number))
  }
  const snapshot = state.status === 'success' ? state.snapshot : null
  return <section className="tracking-panel" aria-labelledby="tracking-heading">
    <div className="tracking-heading">
      <div className="tracking-icon" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path d="M13 8h22a5 5 0 0 1 5 5v18a7 7 0 0 1-7 7H15a7 7 0 0 1-7-7V13a5 5 0 0 1 5-5Z"/><path d="M12 24h24M16 15h5m7 0h5M16 38l-4 5m20-5 4 5M15 32h.1m18 0h.1"/></svg></div>
      <div><span className="tracking-eyebrow">{t('trackingWorkspace')}</span><h2 id="tracking-heading">{t('trackingTitle')}</h2><p>{t('trackingHelp')}</p></div>
    </div>
    <p className="tracking-demo-label"><span aria-hidden="true">●</span>{t('trackingDemoNotice')}</p>
    <form className="tracking-form" onSubmit={submit} noValidate>
      <label htmlFor="train-number">{t('trackingNumber')}</label>
      <div className="tracking-controls"><input id="train-number" value={number} onChange={(event) => setNumber(event.target.value)} autoComplete="off" spellCheck={false} placeholder={t('trackingPlaceholder')} aria-describedby="tracking-input-help"/><button className="tracking-button" type="submit" disabled={state.status === 'loading'}>{state.status === 'loading' ? t('trackingLoading') : t('trackTrain')}</button></div>
      <small id="tracking-input-help">{t('trackingInputHelp')}</small>
    </form>
    {state.status === 'loading' && <div className="tracking-state" role="status" aria-live="polite"><span className="tracking-spinner" aria-hidden="true"/>{t('trackingLoading')}</div>}
    {state.status === 'invalid' && <p className="tracking-error" role="alert">{t(state.message === 'empty' ? 'trackingRequired' : 'trackingInvalid')}</p>}
    {state.status === 'unavailable' && <div className="tracking-empty" role="status"><b>{t('trackingUnavailable')}</b><p>{t('trackingUnavailableHelp')}</p></div>}
    {state.status === 'error' && <p className="tracking-error" role="alert">{t('trackingError')}</p>}
    {snapshot && <article className="tracking-result" aria-live="polite">
      <div className="tracking-result-head"><div><span className="tracking-chip">{t('trackingDemoBadge')}</span><h3>{snapshot.trainNumber}</h3><p>{snapshot.serviceName}</p></div><span className="tracking-schedule-status">{t('trackingScheduledDemo')}</span></div>
      <dl className="tracking-details">
        <div><dt>{t('trackingLastLocation')}</dt><dd>{snapshot.lastLocation}</dd></div>
        <div><dt>{t('trackingLastUpdate')}</dt><dd>{snapshot.lastUpdate}</dd></div>
        <div><dt>{t('trackingNextStation')}</dt><dd>{snapshot.nextStation}</dd></div>
        <div><dt>{t('trackingExpectedArrival')}</dt><dd>{snapshot.expectedArrival}</dd></div>
        <div className="tracking-detail-wide"><dt>{t('trackingStatus')}</dt><dd>{snapshot.status}</dd></div>
      </dl>
      <p className="tracking-disclaimer">{t('trackingDemoNotice')}</p>
    </article>}
    {state.status === 'idle' && <div className="tracking-empty"><b>{t('trackingEmpty')}</b><p>{t('trackingInputHelp')}</p></div>}
  </section>
}
