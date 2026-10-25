import assert from 'node:assert/strict'
import test from 'node:test'
import { searchStations, stations, territoryCoverage, validateStationCatalogue } from '../src/data/stations.ts'
import { services } from '../src/data/services.ts'

test('curated station sample has unique stable identifiers and state/UT coverage metadata', () => {
  assert.ok(stations.length >= 350)
  assert.equal(new Set(stations.map((station) => station.id)).size, stations.length)
  assert.equal(new Set(stations.map((station) => station.stateOrUT)).size, 31)
  assert.equal(territoryCoverage.length, 36)
  assert.ok(territoryCoverage.every((territory) => Number.isInteger(territory.catalogueEntries)))
})

test('station lookup searches station, city and state and omits unknown codes', () => {
  assert.equal(searchStations('Visakhapatnam')[0]?.city, 'Visakhapatnam')
  assert.ok(searchStations('Kochi').some((station) => station.name === 'Ernakulam Junction'))
  assert.ok(searchStations('Kerala').every((station) => station.stateOrUT === 'Kerala'))
  assert.equal(searchStations('not-a-station').length, 0)
  assert.ok(stations.filter((station) => station.code).every((station) => /^[A-Z0-9]{2,5}$/.test(station.code)))
})

test('search can exclude the already selected opposite endpoint', () => {
  assert.ok(!searchStations('', 500, 'NDLS').some((station) => station.id === 'NDLS'))
})

test('duplicate station IDs and duplicate names within a state are rejected', () => {
  const station = stations[0]!
  assert.throws(() => validateStationCatalogue([station, { ...stations[1]!, id: station.id }]), /Duplicate station ID/)
  assert.throws(() => validateStationCatalogue([station, { ...stations[1]!, name: station.name, stateOrUT: station.stateOrUT }]), /Duplicate station name/)
})

test('generated network services have stable synthetic IDs and supported synthetic classes', () => {
  assert.ok(services.length > 2000)
  assert.ok(services.every((service) => /^DEMO-\d{4}$/.test(service.id) && service.number === service.id))
  assert.ok(services.every((service) => (service.syntheticClasses?.length ?? 0) >= 2))
  assert.ok(services.every((service) => service.days.length === 7))
})
