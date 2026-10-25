import type { JourneyOption } from '../types/journey'
import type { ItineraryDecision } from '../types/decision.ts'
import type { MessageKey } from '../i18n.ts'
import { buildRouteInsight } from '../engine/routeInsights.ts'

type Props = { option: JourneyOption; rank: number; selected: boolean; onSelect: () => void; onChoose: () => void; onReview: () => void; decision?: ItineraryDecision; actionLabel?: string; t: (key: MessageKey) => string }
const clock = (date: Date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const duration = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`

export function RouteCard({ option, rank, selected, onSelect, onChoose, onReview, decision, actionLabel, t }: Props) {
  const insight = buildRouteInsight(option, decision)
  return <article className={`route-card ${selected ? 'selected' : ''}`}>
    <button className="route-card-main" onClick={onSelect} type="button" aria-pressed={selected} aria-label={`Inspect route ${rank}: ${option.legs[0].from.name} to ${option.legs.at(-1)?.to.name}`}>
      <div className="route-top"><span className={`rank rank-${rank}`}>{rank === 1 ? t('bestMatch') : `${t('option')} 0${rank}`}</span><span className="score">{option.score}<small> {t('fit')}</small></span></div>
      <div className="route-times"><div><strong>{clock(option.departure)}</strong><small>{option.legs[0].from.name}{option.legs[0].from.code ? ' · ' + option.legs[0].from.code : ''}</small></div><div className="journey-line"><span>{duration(option.durationMinutes)}</span><i /><small>{option.transferCount ? `${option.transferCount} ${option.transferCount > 1 ? t('changes') : t('change')}` : t('direct')}</small></div><div className="arrive"><strong>{clock(option.arrival)}</strong><small>{option.legs.at(-1)?.to.name}{option.legs.at(-1)?.to.code ? ' · ' + option.legs.at(-1)?.to.code : ''}</small></div></div>
      <div className="route-bottom"><span>₹{option.fare.toLocaleString('en-IN')} {t('demoFareText')}</span><span className={option.risk < 20 ? 'risk-good' : 'risk-watch'}>{t('syntheticRisk')} {option.risk}/100</span><span>{option.legs.map((leg) => `${leg.service.id} · ${leg.service.classLabel}`).join(' / ')}</span>{option.transferCount > 0 && <span>{t('connecting')} {t('transferAt')} {option.legs.slice(1).map((leg) => leg.from.name).join(' → ')} · {option.bufferMinutes.map((minutes) => minutes + ' min').join(' / ')} {t('connection')}</span>}</div>
    </button>
    {insight.kind === 'direct' ? <div className="route-connection-summary"><b>{t('direct')}</b><span>{t('directSummary')}</span><p>{insight.recommendation}</p></div> : <div className="route-connection-summary"><b>{t('connectionSummary')}</b>{insight.connections.map((connection, index) => <div className="route-connection-line" key={option.legs[index + 1]?.service.id ?? connection.stationId}><strong>{option.legs[index + 1]?.from.name ?? connection.stationId}</strong><span>{t('window')}: {connection.scheduledMinutes} min</span><span>{t('minimum')}: {connection.minimumMinutes ?? '—'} min</span><span>{t('remaining')}: {connection.remainingMinutes ?? connection.scheduledMinutes} min</span><span className={'connection-state '+(connection.status ?? 'feasible')}>{t(connection.status ?? 'feasible')}</span>{connection.reason&&<small>{connection.reason}</small>}</div>)}<p>{insight.recommendation}</p><button className="assistant-action route-detail-action" type="button" onClick={onReview}>{t('reviewConnection')}</button></div>}
    <button className="choose-train-button" type="button" onClick={onChoose}>{actionLabel ?? 'Select Train / Choose Class'} <span>→</span></button>
  </article>
}
