import type { JourneyOption } from '../types/journey'

type Props = { option: JourneyOption; rank: number; selected: boolean; onSelect: () => void }
const clock = (date: Date) => date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const duration = (value: number) => `${Math.floor(value / 60)}h ${value % 60}m`

export function RouteCard({ option, rank, selected, onSelect }: Props) {
  return <button className={`route-card ${selected ? 'selected' : ''}`} onClick={onSelect} type="button" aria-pressed={selected}>
    <div className="route-top"><span className={`rank rank-${rank}`}>{rank === 1 ? 'BEST MATCH' : `OPTION 0${rank}`}</span><span className="score">{option.score}<small> fit</small></span></div>
    <div className="route-times"><div><strong>{clock(option.departure)}</strong><small>{option.legs[0].from.city}</small></div><div className="journey-line"><span>{duration(option.durationMinutes)}</span><i /><small>{option.transferCount ? `${option.transferCount} change${option.transferCount > 1 ? 's' : ''}` : 'Direct'}</small></div><div className="arrive"><strong>{clock(option.arrival)}</strong><small>{option.legs.at(-1)?.to.city}</small></div></div>
    <div className="route-bottom"><span>₹{option.fare.toLocaleString('en-IN')} est.</span><span className={option.risk < 20 ? 'risk-good' : 'risk-watch'}>◉ {option.risk < 20 ? 'Lower demo risk' : 'Review demo risk'}</span><span>{option.legs.map((leg) => leg.service.number).join(' · ')}</span></div>
  </button>
}
