import assert from 'node:assert/strict'
import test from 'node:test'
import { applyLedgerEvent, createLedgerEvent, createPassengerLedger, reconcileRefundCredits } from '../src/engine/passengerLedger.ts'
import type { PassengerLedger, PassengerLedgerEvent } from '../src/types/ledger.ts'
import type { Passenger } from '../src/types/journey.ts'

const passengers: Passenger[] = [
  { id: 'p1', name: 'Asha', category: 'Adult' },
  { id: 'p2', name: 'Ravi', category: 'Adult' },
]

function event(ledger: PassengerLedger, passengerId: string, type: PassengerLedgerEvent['type'], options: { refundId?: string; amountPaise?: number } = {}) {
  return createLedgerEvent(ledger, passengerId, type, options)
}

function apply(ledger: PassengerLedger, passengerId: string, type: PassengerLedgerEvent['type'], options: { refundId?: string; amountPaise?: number } = {}) {
  const result = applyLedgerEvent(ledger, event(ledger, passengerId, type, options))
  assert.equal(result.ok, true, result.message)
  return result.ledger
}

function startRefund(ledger: PassengerLedger, passengerId = 'p1', amountPaise = 100025): PassengerLedger {
  let next = apply(ledger, passengerId, 'cancellation-requested')
  next = apply(next, passengerId, 'cancellation-accepted')
  return apply(next, passengerId, 'refund-initiated', { refundId: `refund-${passengerId}`, amountPaise })
}

test('duplicate event IDs are idempotent and are not counted twice', () => {
  const initial = createPassengerLedger(passengers)
  const request = event(initial, 'p1', 'cancellation-requested')
  const first = applyLedgerEvent(initial, request)
  assert.equal(first.ok, true)
  if (!first.ok) return
  const duplicate = applyLedgerEvent(first.ledger, request)
  assert.equal(duplicate.ok, true)
  if (!duplicate.ok) return
  assert.equal(duplicate.duplicate, true)
  assert.strictEqual(duplicate.ledger, first.ledger)
  assert.equal(duplicate.ledger.events.length, 1)
})

test('a repeated cancellation attempt is rejected and leaves other passenger records untouched', () => {
  const initial = createPassengerLedger(passengers)
  const first = apply(initial, 'p1', 'cancellation-requested')
  const repeated = applyLedgerEvent(first, event(first, 'p1', 'cancellation-requested'))
  assert.equal(repeated.ok, false)
  assert.equal(first.records.p1.cancellationState, 'requested')
  assert.strictEqual(first.records.p2, initial.records.p2)
  assert.equal(repeated.ledger.events.length, 1)
})

test('invalid state transitions are rejected without changing the ledger', () => {
  const initial = createPassengerLedger(passengers)
  const result = applyLedgerEvent(initial, event(initial, 'p1', 'refund-processing'))
  assert.equal(result.ok, false)
  assert.match(result.message, /initiated refund/i)
  assert.strictEqual(result.ledger, initial)
  assert.equal(initial.records.p1.refundState, 'not-started')
})

test('money is held in integer paise and amount changes after initiation are rejected', () => {
  const initiated = startRefund(createPassengerLedger(passengers))
  assert.equal(initiated.records.p1.refundAmountPaise, 100025)
  const amountChange = applyLedgerEvent(initiated, event(initiated, 'p1', 'refund-processing', { refundId: 'refund-p1', amountPaise: 100026 }))
  assert.equal(amountChange.ok, false)
  assert.match(amountChange.message, /changed after initiation/i)
  const fractional = applyLedgerEvent(initiated, event(initiated, 'p1', 'refund-processing', { refundId: 'refund-p1', amountPaise: 1.25 }))
  assert.equal(fractional.ok, false)
  assert.match(fractional.message, /integer paise/i)
})

test('refund lifecycle is explicit and final credit reconciles once', () => {
  let ledger = startRefund(createPassengerLedger(passengers))
  assert.equal(ledger.records.p1.cancellationState, 'accepted')
  assert.equal(ledger.records.p1.refundState, 'initiated')
  ledger = apply(ledger, 'p1', 'refund-processing', { refundId: 'refund-p1', amountPaise: 100025 })
  assert.equal(ledger.records.p1.refundState, 'processing')
  const credit = event(ledger, 'p1', 'refund-credited', { refundId: 'refund-p1', amountPaise: 100025 })
  const credited = applyLedgerEvent(ledger, credit)
  assert.equal(credited.ok, true)
  if (!credited.ok) return
  ledger = credited.ledger
  assert.equal(ledger.records.p1.refundState, 'credited')

  const replay = applyLedgerEvent(ledger, credit)
  assert.equal(replay.ok, true)
  if (!replay.ok) return
  assert.equal(replay.duplicate, true)
  const secondCredit = applyLedgerEvent(ledger, event(ledger, 'p1', 'refund-credited', { refundId: 'refund-p1', amountPaise: 100025 }))
  assert.equal(secondCredit.ok, false)

  const reconciliation = reconcileRefundCredits(ledger)
  assert.deepEqual(reconciliation, { creditedRefundCount: 1, creditedAmountPaise: 100025, recordedCreditedAmountPaise: 100025, matches: true })
})

test('cancelling one passenger does not alter a second passenger or their ledger state', () => {
  const initial = createPassengerLedger(passengers)
  const next = apply(initial, 'p1', 'cancellation-requested')
  assert.equal(next.records.p1.cancellationState, 'requested')
  assert.equal(next.records.p2.cancellationState, 'none')
  assert.equal(next.records.p2.refundState, 'not-started')
  assert.strictEqual(next.records.p2, initial.records.p2)
})

test('rejected and failed refunds remain distinct terminal states', () => {
  let rejected = startRefund(createPassengerLedger(passengers))
  rejected = apply(rejected, 'p1', 'refund-rejected', { refundId: 'refund-p1', amountPaise: 100025 })
  assert.equal(rejected.records.p1.refundState, 'rejected')

  let failed = startRefund(createPassengerLedger(passengers))
  failed = apply(failed, 'p1', 'refund-processing', { refundId: 'refund-p1', amountPaise: 100025 })
  failed = apply(failed, 'p1', 'refund-failed', { refundId: 'refund-p1', amountPaise: 100025 })
  assert.equal(failed.records.p1.refundState, 'failed')
})
