import type { Disruption, SeatPreferenceOption, Service, SyntheticClassOption, TrainClassCode } from '../types/journey.ts'
import { stations } from './stations.ts'

// Every service, schedule, class status and fare in this fixture is synthetic demo data.
const daily = [0, 1, 2, 3, 4, 5, 6]
const clock = (minute: number) => String(Math.floor(minute / 60) % 24).padStart(2, '0') + ':' + String(minute % 60).padStart(2, '0')
type Seed = { from: string; to: string; depart: string; duration: number; label: string }
const seeds: Seed[] = [
  ['NDLS','AGC','06:10',135,'Regional demo connector'], ['AGC','JP','09:05',185,'Intercity demo connector'], ['NDLS','JP','07:15',305,'Direct demo express'],
  ['NDLS','BPL','08:00',485,'Intercity demo service'], ['BPL','MMCT','17:10',385,'Overnight demo express'], ['NDLS','LKO','06:45',345,'Intercity demo service'],
  ['LKO','CNB','13:20',95,'Regional demo connector'], ['NDLS','CNB','09:20',440,'Direct demo express'], ['AGC','BPL','10:15',450,'Intercity demo service'],
  ['JP','BPL','13:10',470,'Intercity demo service'], ['AGC','NDLS','07:00',120,'Regional demo connector'], ['JP','NDLS','06:45',165,'Intercity demo connector'],
  ['BPL','NDLS','06:30',180,'Intercity demo service'], ['MMCT','NDLS','05:15',720,'Overnight demo express'], ['LKO','NDLS','06:45',150,'Intercity demo service'],
  ['CNB','NDLS','06:30',165,'Intercity demo service'], ['NDLS','MMCT','11:00',550,'Direct demo express'], ['NDLS','AGC','11:00',130,'Regional demo connector'],
  ['NDLS','JP','11:15',225,'Direct demo express'], ['NDLS','BPL','11:30',390,'Intercity demo service'], ['NDLS','LKO','11:00',255,'Intercity demo service'],
  ['NDLS','CNB','11:15',255,'Intercity demo service'],
].map(([from,to,depart,duration,label]) => ({ from: String(from), to: String(to), depart: String(depart), duration: Number(duration), label: String(label) }))
const hubIds = [...new Set(stations.map((station) => station.networkHubId).filter((id): id is string => Boolean(id)))].sort()
const stationById = new Map(stations.map((station) => [station.id, station]))
for (const station of stations) {
  const hub = station.networkHubId
  if (!hub || hub === station.id) continue
  const offset = station.id.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 90
  const duration = 65 + offset
  for (const depart of [300 + offset % 35, 570 + offset % 35]) seeds.push({ from: station.id, to: hub, depart: clock(depart), duration, label: 'Regional synthetic connector' })
  for (const depart of [840 + offset % 25, 1110 + offset % 25]) seeds.push({ from: hub, to: station.id, depart: clock(depart), duration, label: 'Regional synthetic connector' })
}
for (let left = 0; left < hubIds.length; left += 1) for (let right = left + 1; right < hubIds.length; right += 1) {
  const a = hubIds[left], b = hubIds[right]
  if (!a || !b || !stationById.has(a) || !stationById.has(b)) continue
  const duration = 180 + ((left * 73 + right * 47) % 390)
  for (const [from, to] of [[a, b], [b, a]]) for (const depart of ['07:30', '12:30', '17:00']) seeds.push({ from, to, depart, duration, label: 'Inter-regional synthetic express' })
}

const noPreference: SeatPreferenceOption = { code: 'none', label: 'No preference', kind: 'none' }
const berth = (code: string, label: string): SeatPreferenceOption => ({ code, label, kind: 'berth' })
const seat = (code: string, label: string): SeatPreferenceOption => ({ code, label, kind: 'seat' })
const threeTier = [berth('lower','Lower berth'), berth('middle','Middle berth'), berth('upper','Upper berth'), berth('side-lower','Side lower berth'), berth('side-upper','Side upper berth'), noPreference]
const twoTier = [berth('lower','Lower berth'), berth('upper','Upper berth'), berth('side-lower','Side lower berth'), berth('side-upper','Side upper berth'), noPreference]
const seating = [seat('window','Window seat'), seat('aisle','Aisle seat'), noPreference]
const classInfo: Record<TrainClassCode, { name: string; description: string; base: number; minute: number; preferences: SeatPreferenceOption[] }> = {
  '1A': { name: 'AC First Class', description: 'Premium air-conditioned cabin in this synthetic model.', base: 180000, minute: 1500, preferences: [berth('lower','Lower berth'), berth('upper','Upper berth'), noPreference] },
  '2A': { name: 'AC 2-Tier', description: 'Air-conditioned sleeping accommodation with two berth levels.', base: 105000, minute: 880, preferences: twoTier },
  '3A': { name: 'AC 3-Tier', description: 'Air-conditioned sleeping accommodation with three berth levels.', base: 76000, minute: 620, preferences: threeTier },
  SL: { name: 'Sleeper Class', description: 'Non-air-conditioned sleeping accommodation.', base: 34000, minute: 310, preferences: threeTier },
  CC: { name: 'AC Chair Car', description: 'Air-conditioned reserved seating in this synthetic model.', base: 36000, minute: 390, preferences: seating },
  '2S': { name: 'Second Sitting', description: 'Non-air-conditioned reserved seating.', base: 15000, minute: 210, preferences: seating },
}
const classSets: TrainClassCode[][] = [['CC','2S','3A','SL'], ['2A','3A','SL','CC'], ['1A','2A','3A','SL'], ['2A','3A','SL','2S'], ['2A','3A','CC','2S']]
const edgeCounts = new Map<string, number>()
export const services: Service[] = seeds.map((seed, index) => {
  const edge = seed.from + '>' + seed.to
  const edgeOrdinal = edgeCounts.get(edge) ?? 0
  edgeCounts.set(edge, edgeOrdinal + 1)
  const [h,m] = seed.depart.split(':').map(Number)
  const departure = (h ?? 0) * 60 + (m ?? 0)
  const arrive = clock(departure + seed.duration)
  const id = 'DEMO-' + String(1001 + index).padStart(4, '0')
  const isFamiliarDelhiJaipurDirect = seed.from === 'NDLS' && seed.to === 'JP' && seed.label === 'Direct demo express'
  const classCodes = isFamiliarDelhiJaipurDirect
    ? ['1A','2A','3A','SL'] as TrainClassCode[]
    : seed.label === 'Regional demo connector'
      ? classSets[edgeOrdinal % 2 === 0 ? 0 : 1]!
      : classSets[(index + edgeOrdinal) % classSets.length] ?? classSets[0]!
  const syntheticClasses: SyntheticClassOption[] = classCodes.map((code, classIndex) => {
    const item = classInfo[code]
    const arrivalMinutes = ((Number(arrive.slice(0,2)) * 60 + Number(arrive.slice(3))) <= departure ? 1440 : 0) + Number(arrive.slice(0,2)) * 60 + Number(arrive.slice(3))
    return { code, name: item.name, description: item.description, demoAvailability: (index + classIndex) % 4 === 0 ? 'limited-demo' : 'available-demo', farePaisePerPassenger: item.base + (arrivalMinutes - departure) * item.minute, seatPreferences: item.preferences }
  })
  const syntheticAccessibilityFeatures = index % 3 === 0 ? ['step-free-boarding', 'priority-seating'] : index % 2 === 0 ? ['priority-seating'] : []
  return { id, number: id, from: seed.from, to: seed.to, depart: seed.depart, arrive, days: daily, classLabel: seed.label, syntheticClasses, syntheticAccessibilityFeatures }
})
export const disruptions: Disruption[] = [
  { id: 'demo-disruption-1', serviceId: 'DEMO-1003', level: 'caution', title: 'Synthetic schedule margin', detail: 'Illustrative risk note only; this is not a live railway alert.' },
  { id: 'demo-disruption-2', stationId: 'AGC', level: 'watch', title: 'Synthetic interchange note', detail: 'Illustrative demo guidance: allow extra time at this interchange.' },
  { id: 'demo-disruption-3', serviceId: 'DEMO-1005', level: 'clear', title: 'Baseline demo scenario', detail: 'No disruption is applied in the synthetic baseline.' },
]
