import { useId, useState } from 'react'
import { searchStations, stations } from '../data/stations.ts'
import { localizedStationName, translate } from '../i18n.ts'
import type { Language } from '../i18n.ts'

type Props = { label: string; value: string; onChange: (stationId: string) => void; excludeId?: string; required?: boolean; language?: Language }
export function StationCombobox({ label, value, onChange, excludeId, required = true, language = 'en' }: Props) {
  const id = useId()
  const selected = stations.find((station) => station.id === value)
  const stationText = (station: typeof selected) => station ? localizedStationName(language, station.code ?? station.id, station.name) : ''
  const [inputState, setInputState] = useState({ stationId: value, text: stationText(selected) })
  const query = inputState.stationId === value ? inputState.text : stationText(selected) || inputState.text
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const excluded = excludeId ?? (value || undefined)
  const matches = query.trim() && language !== 'en'
    ? [...stations.filter((station) => station.id !== excluded && localizedStationName(language, station.code ?? station.id, station.name).toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())), ...searchStations(query, 12, excluded)].filter((station, index, all) => all.findIndex((candidate) => candidate.id === station.id) === index).slice(0, 12)
    : searchStations(query, 12, excluded)

  function select(stationId: string) {
    const station = stations.find((item) => item.id === stationId)
    if (!station) return
    onChange(station.id)
    setInputState({ stationId, text: stationText(station) })
    setOpen(false)
    setActiveIndex(0)
  }

  return <div className="station-combobox">
    <label htmlFor={id}><span>{label}</span></label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={id + '-list'} aria-activedescendant={open && matches[activeIndex] ? id + '-option-' + activeIndex : undefined} autoComplete="off" required={required} value={query} placeholder={translate(language,'stationSearch')} onFocus={() => { setInputState({ stationId: value, text: '' }); setOpen(true) }} onChange={(event) => { setInputState({ stationId: '', text: event.target.value }); onChange(''); setOpen(true); setActiveIndex(0) }} onBlur={() => window.setTimeout(() => { setOpen(false); const current = stations.find((station) => station.id === value); if (current) setInputState({ stationId: value, text: stationText(current) }) }, 120)} onKeyDown={(event) => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(matches.length - 1, index + 1)) }
      else if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)) }
      else if (event.key === 'Enter' && open && matches[activeIndex]) { event.preventDefault(); select(matches[activeIndex]!.id) }
      else if (event.key === 'Escape') setOpen(false)
    }} />
    {open && <ul className="station-suggestions" id={id + '-list'} role="listbox" aria-label={label + ' suggestions'}>
      {matches.length ? matches.map((station, index) => <li id={id + '-option-' + index} key={station.id} role="option" aria-selected={station.id === value} className={index === activeIndex ? 'active' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => select(station.id)}>{localizedStationName(language,station.code ?? station.id,station.name)}{station.code ? ' · ' + station.code : ''}<small>{station.city} · {station.stateOrUT}</small></li>) : <li className="station-no-match">{translate(language,'stationNoMatch')}</li>}
    </ul>}
  </div>
}
