import { DEFAULT_RANKING_CONFIGURATION, rankItineraries } from './decisionEngine.ts'
import { disruptions as demoDisruptions, services as demoServices, stations as demoStations } from '../data/railway.ts'
import type { Itinerary, PassengerProfile, RankingConfiguration } from '../types/decision.ts'
import type { JourneyLeg, JourneyOption, JourneyPlanResult, JourneyRequest, Service } from '../types/journey.ts'

const atLocalTime = (date: Date, value: string) => {
  const [hour, minute] = value.split(':').map(Number)
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

function nextServiceTime(service: Service, earliest: Date): { departAt: Date; arriveAt: Date } | null {
  const departMinutes = Number(service.depart.slice(0, 2)) * 60 + Number(service.depart.slice(3))
  const arriveMinutes = Number(service.arrive.slice(0, 2)) * 60 + Number(service.arrive.slice(3))
  const duration = (arriveMinutes <= departMinutes ? arriveMinutes + 1440 : arriveMinutes) - departMinutes
  for (let offset = 0; offset <= 7; offset += 1) {
    const day = new Date(earliest)
    day.setDate(day.getDate() + offset)
    if (!service.days.includes(day.getDay())) continue
    const departAt = atLocalTime(day, service.depart)
    if (departAt < earliest) continue
    return { departAt, arriveAt: new Date(departAt.getTime() + duration * 60000) }
  }
  return null
}

function createProfiles(request: JourneyRequest): PassengerProfile[] {
  if (request.passengerProfiles?.length) return request.passengerProfiles
  return Array.from({ length: Math.max(1, request.passengers) }, (_, index) => ({ id: `synthetic-passenger-${index + 1}`, category: 'adult' as const }))
}

export function toDecisionItinerary(option: JourneyOption, profiles: PassengerProfile[], disruptions: typeof demoDisruptions = demoDisruptions): Itinerary {
  const legs = option.legs.map((leg, index) => ({
    id: `${option.id}-leg-${index + 1}`,
    serviceId: leg.service.id,
    fromStationId: leg.from.id,
    toStationId: leg.to.id,
    scheduledDepartureAt: leg.departAt.toISOString(),
    scheduledArrivalAt: leg.arriveAt.toISOString(),
    ticketStatus: 'unbooked' as const,
  }))
  const availableFeatures = option.legs.map((leg) => leg.service.syntheticAccessibilityFeatures ?? [])
  const accessibilityFeatures = availableFeatures.length ? availableFeatures[0].filter((feature) => availableFeatures.every((features) => features.includes(feature))) : []
  const arrivalTimeRisk = Math.min(100, option.legs.reduce((sum, leg) => sum + (disruptions.find((event) => event.serviceId === leg.service.id && event.level === 'caution') ? 30 : 0), 0))
  return {
    id: option.id,
    legs,
    passengers: profiles,
    accessibilityFeatures,
    scoringFactors: { arrivalTimeRisk, farePaise: option.fare * 100, confirmationUncertainty: 100, synthetic: true },
  }
}

export function planJourneyDetailed(
  request: JourneyRequest,
  services = demoServices,
  stations = demoStations,
  disruptions = demoDisruptions,
  rankingConfiguration: RankingConfiguration = request.rankingConfiguration ?? DEFAULT_RANKING_CONFIGURATION,
): JourneyPlanResult {
  const candidates: JourneyOption[] = []
  const start = atLocalTime(new Date(`${request.date}T12:00:00`), request.time)
  const stationIds = new Set(stations.map((station) => station.id))
  const stationById = new Map(stations.map((station) => [station.id, station]))
  const servicesByOrigin = new Map<string, Service[]>()
  for (const service of services) servicesByOrigin.set(service.from, [...(servicesByOrigin.get(service.from) ?? []), service])
  if (!stationIds.has(request.origin) || !stationIds.has(request.destination) || request.origin === request.destination || Number.isNaN(start.getTime())) return { options: [], decisions: [] }
  const targetHubId = stationById.get(request.destination)?.networkHubId
  const addOption = (path: Service[]) => {
    if (path.length === 0 || path.length > 3) return
    const legs: JourneyLeg[] = []
    path.forEach((service, index) => {
      const earliest = index === 0 ? start : legs[index - 1].arriveAt
      const times = nextServiceTime(service, earliest)
      const from = stationById.get(service.from)
      const to = stationById.get(service.to)
      if (!times || !from || !to) return
      legs.push({ service, from, to, ...times })
    })
    if (legs.length !== path.length) return
    const buffers = legs.slice(1).map((leg, index) => Math.round((leg.departAt.getTime() - legs[index].arriveAt.getTime()) / 60000))
    const durationMinutes = Math.round((legs.at(-1)!.arriveAt.getTime() - legs[0].departAt.getTime()) / 60000)
    const cautionRisk = Math.min(100, path.reduce((sum, service) => sum + (disruptions.some((event) => event.serviceId === service.id && event.level === 'caution') ? 30 : 0), 0))
    const fare = Math.round(520 + durationMinutes * 2.7 + (path.length - 1) * 115)
    candidates.push({
      id: path.map((service) => service.id).join('-'), legs, departure: legs[0].departAt, arrival: legs.at(-1)!.arriveAt,
      durationMinutes, transferCount: path.length - 1, bufferMinutes: buffers, risk: cautionRisk, score: 0, fare,
      reasons: [],
    })
  }
  const walk = (stationId: string, path: Service[], visited: Set<string>) => {
    if (path.length >= 3) return
    const outgoing = servicesByOrigin.get(stationId) ?? []
    const currentIsHub = stationById.get(stationId)?.networkHubId === stationId
    const directToTargetHubExists = currentIsHub && Boolean(targetHubId && outgoing.some((service) => service.to === targetHubId))
    for (const service of outgoing) {
      if (visited.has(service.to)) continue
      const nextIsHub = stationById.get(service.to)?.networkHubId === service.to
      // Avoid needless hub-to-hub detours when the connected backbone provides a direct
      // service to the destination's hub. This keeps route alternatives useful and search bounded.
      if (currentIsHub && nextIsHub && directToTargetHubExists && service.to !== targetHubId) continue
      const nextPath = [...path, service]
      if (service.to === request.destination) addOption(nextPath)
      else walk(service.to, nextPath, new Set([...visited, service.to]))
    }
  }
  walk(request.origin, [], new Set([request.origin]))

  const profiles = createProfiles(request)
  const itineraries = candidates.map((candidate) => toDecisionItinerary(candidate, profiles, disruptions))
  const decisions = rankItineraries(itineraries, rankingConfiguration)
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]))
  const options = decisions.filter((decision) => decision.accepted).slice(0, 8).map((decision) => {
    const candidate = candidateById.get(decision.itineraryId)!
    const arrivalRisk = decision.scoreExplanations.find((factor) => factor.factor === 'arrivalTimeRisk')?.inputValue ?? 50
    const connectionRisk = decision.scoreExplanations.find((factor) => factor.factor === 'connectionRisk')?.inputValue ?? 50
    const reasons = [
      ...decision.scoreExplanations.map((factor) => `${factor.factor}: ${factor.normalizedScore.toFixed(1)}/100 (weight ${factor.weight}; contribution ${factor.weightedContribution.toFixed(2)}). ${factor.explanation}`),
      decision.rankingExplanation,
    ]
    return { ...candidate, score: decision.score ?? 0, risk: Math.min(100, Math.round(arrivalRisk + connectionRisk)), reasons }
  })
  return { options, decisions }
}

export function planJourney(request: JourneyRequest, services = demoServices, stations = demoStations, disruptions = demoDisruptions): JourneyOption[] {
  return planJourneyDetailed(request, services, stations, disruptions).options
}
