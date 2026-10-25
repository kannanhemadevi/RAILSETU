import { services } from '../data/services.ts'
import { stations } from '../data/stations.ts'

export type TrackingSnapshot = {
  trainNumber: string
  serviceName: string
  lastLocation: string
  lastUpdate: string
  nextStation: string
  expectedArrival: string
  status: string
  provenance: 'synthetic-demo'
}
export type TrackingState =
  | { status: 'idle' }
  | { status: 'loading'; trainNumber: string }
  | { status: 'invalid'; message: 'empty' | 'format' }
  | { status: 'unavailable'; trainNumber: string }
  | { status: 'success'; snapshot: TrackingSnapshot }
  | { status: 'error'; trainNumber: string }

export interface TrainTrackingProvider {
  readonly mode: 'live' | 'demo'
  lookup(trainNumber: string): Promise<TrackingSnapshot | null>
}

export function startTracking(input: string): TrackingState {
  const trainNumber = input.trim().toUpperCase()
  if (!trainNumber) return { status: 'invalid', message: 'empty' }
  if (!/^[A-Z0-9][A-Z0-9-]{2,19}$/.test(trainNumber)) return { status: 'invalid', message: 'format' }
  return { status: 'loading', trainNumber }
}

/** No live provider is configured in this project. The built-in provider only reads synthetic fixtures. */
export const demoTrainTrackingProvider: TrainTrackingProvider = {
  mode: 'demo',
  async lookup(trainNumber) {
    const service = services.find((item) => item.id.toUpperCase() === trainNumber || item.number.toUpperCase() === trainNumber)
    if (!service) return null
    const from = stations.find((station) => station.id === service.from)?.name ?? service.from
    const to = stations.find((station) => station.id === service.to)?.name ?? service.to
    return {
      trainNumber: service.number,
      serviceName: service.classLabel,
      lastLocation: `${from} · synthetic origin marker`,
      lastUpdate: `${service.depart} scheduled demo marker`,
      nextStation: to,
      expectedArrival: `${service.arrive} scheduled demo time`,
      status: 'No delay value is configured in this synthetic snapshot.',
      provenance: 'synthetic-demo',
    }
  },
}

export async function requestTrainTracking(input: string, provider: TrainTrackingProvider = demoTrainTrackingProvider): Promise<TrackingState> {
  const started = startTracking(input)
  if (started.status !== 'loading') return started
  try {
    const snapshot = await provider.lookup(started.trainNumber)
    return snapshot ? { status: 'success', snapshot } : { status: 'unavailable', trainNumber: started.trainNumber }
  } catch {
    return { status: 'error', trainNumber: started.trainNumber }
  }
}
