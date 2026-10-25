import assert from 'node:assert/strict'
import test from 'node:test'
import { demoTrainTrackingProvider, requestTrainTracking, startTracking } from '../src/engine/trainTracking.ts'

test('train tracking validates empty and malformed input and exposes a loading state for a valid ID', () => {
  assert.deepEqual(startTracking('  '), { status: 'invalid', message: 'empty' })
  assert.deepEqual(startTracking('12!'), { status: 'invalid', message: 'format' })
  assert.deepEqual(startTracking(' demo-1001 '), { status: 'loading', trainNumber: 'DEMO-1001' })
})

test('demo lookup returns a clearly synthetic schedule snapshot, never a live position', async () => {
  assert.equal(demoTrainTrackingProvider.mode, 'demo')
  const result = await requestTrainTracking('demo-1001')
  assert.equal(result.status, 'success')
  if (result.status !== 'success') return
  assert.equal(result.snapshot.trainNumber, 'DEMO-1001')
  assert.equal(result.snapshot.provenance, 'synthetic-demo')
  assert.match(result.snapshot.lastLocation, /synthetic origin marker/)
  assert.match(result.snapshot.lastUpdate, /scheduled demo marker/)
  assert.match(result.snapshot.expectedArrival, /scheduled demo time/)
  assert.match(result.snapshot.status, /No delay value/)
})

test('unknown IDs report unavailable and provider failures remain distinct errors', async () => {
  assert.deepEqual(await requestTrainTracking('12345'), { status: 'unavailable', trainNumber: '12345' })
  const brokenProvider = { mode: 'live' as const, async lookup() { throw new Error('network failure') } }
  assert.deepEqual(await requestTrainTracking('12345', brokenProvider), { status: 'error', trainNumber: '12345' })
})
