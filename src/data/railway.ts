import type { Disruption, Service, Station } from '../types/journey'

// Entirely synthetic demo fixtures. They do not represent live railway information.
export const stations: Station[] = [
  { id: 'NDLS', name: 'New Delhi', code: 'NDLS', city: 'Delhi' },
  { id: 'AGC', name: 'Agra Cantt', code: 'AGC', city: 'Agra' },
  { id: 'JP', name: 'Jaipur Junction', code: 'JP', city: 'Jaipur' },
  { id: 'BPL', name: 'Bhopal Junction', code: 'BPL', city: 'Bhopal' },
  { id: 'MMCT', name: 'Mumbai Central', code: 'MMCT', city: 'Mumbai' },
  { id: 'LKO', name: 'Lucknow NR', code: 'LKO', city: 'Lucknow' },
  { id: 'CNB', name: 'Kanpur Central', code: 'CNB', city: 'Kanpur' },
]

const daily = [0, 1, 2, 3, 4, 5, 6]
export const services: Service[] = [
  { id: 's1', number: 'RS 2041', from: 'NDLS', to: 'AGC', depart: '06:10', arrive: '08:25', days: daily, classLabel: 'Intercity' },
  { id: 's2', number: 'RS 3180', from: 'AGC', to: 'JP', depart: '09:05', arrive: '12:10', days: daily, classLabel: 'Express' },
  { id: 's3', number: 'RS 2048', from: 'NDLS', to: 'JP', depart: '07:15', arrive: '12:20', days: daily, classLabel: 'Direct express' },
  { id: 's4', number: 'RS 4422', from: 'NDLS', to: 'BPL', depart: '08:00', arrive: '16:05', days: daily, classLabel: 'Intercity' },
  { id: 's5', number: 'RS 7710', from: 'BPL', to: 'MMCT', depart: '17:10', arrive: '23:35', days: daily, classLabel: 'Overnight express' },
  { id: 's6', number: 'RS 2294', from: 'NDLS', to: 'LKO', depart: '06:45', arrive: '12:30', days: daily, classLabel: 'Express' },
  { id: 's7', number: 'RS 1840', from: 'LKO', to: 'CNB', depart: '13:20', arrive: '14:55', days: daily, classLabel: 'Regional' },
  { id: 's8', number: 'RS 5503', from: 'NDLS', to: 'CNB', depart: '09:20', arrive: '16:40', days: daily, classLabel: 'Direct express' },
  { id: 's9', number: 'RS 9031', from: 'AGC', to: 'BPL', depart: '10:15', arrive: '17:45', days: daily, classLabel: 'Intercity' },
  { id: 's10', number: 'RS 1198', from: 'JP', to: 'BPL', depart: '13:10', arrive: '21:00', days: daily, classLabel: 'Express' },
  // Synthetic daily spokes make the demo network traversable between every listed station.
  // Feeder services reach NDLS before the connecting departures below, leaving at least
  // 60 minutes for a transfer at the demo hub.
  { id: 's11', number: 'RS 6120', from: 'AGC', to: 'NDLS', depart: '07:00', arrive: '09:00', days: daily, classLabel: 'Intercity' },
  { id: 's12', number: 'RS 7142', from: 'JP', to: 'NDLS', depart: '06:45', arrive: '09:30', days: daily, classLabel: 'Express' },
  { id: 's13', number: 'RS 8216', from: 'BPL', to: 'NDLS', depart: '06:30', arrive: '09:30', days: daily, classLabel: 'Intercity' },
  { id: 's14', number: 'RS 9324', from: 'MMCT', to: 'NDLS', depart: '05:15', arrive: '09:15', days: daily, classLabel: 'Overnight express' },
  { id: 's15', number: 'RS 2470', from: 'LKO', to: 'NDLS', depart: '06:45', arrive: '09:15', days: daily, classLabel: 'Express' },
  { id: 's16', number: 'RS 3558', from: 'CNB', to: 'NDLS', depart: '06:30', arrive: '09:15', days: daily, classLabel: 'Intercity' },
  { id: 's17', number: 'RS 1050', from: 'NDLS', to: 'MMCT', depart: '11:00', arrive: '20:10', days: daily, classLabel: 'Direct express' },
  { id: 's18', number: 'RS 2164', from: 'NDLS', to: 'AGC', depart: '11:00', arrive: '13:10', days: daily, classLabel: 'Intercity' },
  { id: 's19', number: 'RS 3278', from: 'NDLS', to: 'JP', depart: '11:15', arrive: '15:00', days: daily, classLabel: 'Express' },
  { id: 's20', number: 'RS 4382', from: 'NDLS', to: 'BPL', depart: '11:30', arrive: '18:00', days: daily, classLabel: 'Intercity' },
  { id: 's21', number: 'RS 5496', from: 'NDLS', to: 'LKO', depart: '11:00', arrive: '15:15', days: daily, classLabel: 'Express' },
  { id: 's22', number: 'RS 6504', from: 'NDLS', to: 'CNB', depart: '11:15', arrive: '15:30', days: daily, classLabel: 'Intercity' },
]

export const disruptions: Disruption[] = [
  { id: 'd1', serviceId: 's3', level: 'caution', title: 'Tight schedule margin', detail: 'This demo service has a simulated 15 minute delay risk.' },
  { id: 'd2', stationId: 'AGC', level: 'watch', title: 'Busy interchange', detail: 'Synthetic crowding note: allow extra time at Agra Cantt.' },
  { id: 'd3', serviceId: 's5', level: 'clear', title: 'Clear in demo scenario', detail: 'No simulated disruption on this service.' },
]
