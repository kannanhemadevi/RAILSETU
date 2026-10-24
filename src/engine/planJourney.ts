import { disruptions as demoDisruptions, services as demoServices, stations as demoStations } from '../data/railway.ts'
import type { JourneyLeg, JourneyOption, JourneyRequest, Service } from '../types/journey'

const atLocalTime = (date: Date, value: string) => {
  const [hour, minute] = value.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

function nextServiceTime(service: Service, earliest: Date): { departAt: Date; arriveAt: Date } | null {
  const duration = (() => {
    const departMinutes = Number(service.depart.slice(0, 2)) * 60 + Number(service.depart.slice(3))
    const arriveMinutes = Number(service.arrive.slice(0, 2)) * 60 + Number(service.arrive.slice(3))
    return (arriveMinutes <= departMinutes ? arriveMinutes + 1440 : arriveMinutes) - departMinutes
  })()
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(earliest)
    day.setDate(day.getDate() + offset)
    if (!service.days.includes(day.getDay())) continue
    const departAt = atLocalTime(day, service.depart)
    if (departAt < earliest) continue
    const arriveAt = new Date(departAt.getTime() + duration * 60000)
    return { departAt, arriveAt }
  }
  return null
}

export function planJourney(
  request: JourneyRequest,
  services = demoServices,
  stations = demoStations,
  disruptions = demoDisruptions,
): JourneyOption[] {
  const options: JourneyOption[] = []
  const start = atLocalTime(new Date(`${request.date}T12:00:00`), request.time)
  const stationIds = new Set(stations.map((station) => station.id))
  if (!stationIds.has(request.origin) || !stationIds.has(request.destination) || request.origin === request.destination || Number.isNaN(start.getTime())) return options
  const minimumTransferMinutes = 25
  const maximumTransferMinutes = 240
  const addOption = (path: Service[]) => {
    if (path.length === 0 || path.length > 3) return
    const legs: JourneyLeg[] = []
    path.forEach((service, index) => {
      const earliest = index === 0 ? start : new Date(legs[index - 1].arriveAt.getTime() + minimumTransferMinutes * 60000)
      const times = nextServiceTime(service, earliest)
      const from = stations.find((station) => station.id === service.from)
      const to = stations.find((station) => station.id === service.to)
      if (!times || !from || !to) return
      legs.push({ service, from, to, ...times })
    })
    if (legs.length !== path.length) return
    const buffers = legs.slice(1).map((leg, i) => Math.round((leg.departAt.getTime() - legs[i].arriveAt.getTime()) / 60000))
    if (buffers.some((buffer) => buffer < minimumTransferMinutes || buffer > maximumTransferMinutes)) return
    const durationMinutes = Math.round((legs[legs.length - 1].arriveAt.getTime() - legs[0].departAt.getTime()) / 60000)
    const risk = Math.min(100, legs.reduce((total, leg) => total + (disruptions.find((d) => d.serviceId === leg.service.id)?.level === 'caution' ? 30 : 0) + (disruptions.find((d) => d.stationId === leg.to.id)?.level === 'watch' ? 12 : 0), 0) + buffers.reduce((t, buffer) => t + (buffer < 40 ? 15 : 0), 0))
    const reliability = 100 - risk
    const comfort = Math.max(15, 100 - path.length * 16 - buffers.filter((b) => b > 180).length * 14)
    const speed = Math.max(10, 100 - durationMinutes / 7)
    const { reliability: rw, comfort: cw, speed: sw } = request.priorities
    const score = Math.round((reliability * rw + comfort * cw + speed * sw) / Math.max(1, rw + cw + sw))
    options.push({ id: path.map((s) => s.id).join('-'), legs, departure: legs[0].departAt, arrival: legs.at(-1)!.arriveAt, durationMinutes, transferCount: path.length - 1, bufferMinutes: buffers, risk, score, fare: Math.round(520 + durationMinutes * 2.7 + (path.length - 1) * 115), reasons: [risk < 20 ? 'Lower simulated disruption exposure' : 'Review synthetic disruption note', path.length === 1 ? 'No transfers required' : `${path.length - 1} planned connection${path.length > 2 ? 's' : ''}`, `${durationMinutes < 300 ? 'Shorter journey time' : 'Connection margin included'}`] })
  }
  const walk = (stationId: string, path: Service[], visited: Set<string>) => {
    if (path.length >= 3) return
    for (const service of services.filter((candidate) => candidate.from === stationId && !visited.has(candidate.to))) {
      const nextPath = [...path, service]
      if (service.to === request.destination) addOption(nextPath)
      else walk(service.to, nextPath, new Set([...visited, service.to]))
    }
  }
  walk(request.origin, [], new Set([request.origin]))
  return options.sort((a, b) => b.score - a.score || a.durationMinutes - b.durationMinutes).slice(0, 8)
}
