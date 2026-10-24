import type { Passenger } from '../types/journey.ts'
import type { LedgerTransitionResult, PassengerLedger, PassengerLedgerEvent, PassengerTicketLedgerRecord, RefundReconciliation } from '../types/ledger.ts'

const DEMO_PAID_AMOUNT_PAISE = 125000
const LEDGER_EPOCH = Date.parse('2030-01-07T00:00:00.000Z')

function validPaise(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0
}

export function createPassengerLedger(passengers: Passenger[]): PassengerLedger {
  const records: Record<string, PassengerTicketLedgerRecord> = {}
  for (const passenger of passengers) {
    if (records[passenger.id]) throw new Error(`Duplicate passenger ID: ${passenger.id}`)
    records[passenger.id] = {
      passengerId: passenger.id,
      passengerName: passenger.name,
      syntheticTicketId: `DEMO-${passenger.id}`,
      ticketState: 'confirmed-demo',
      cancellationState: 'none',
      refundState: 'not-started',
      paidAmountPaise: DEMO_PAID_AMOUNT_PAISE,
      refundAmountPaise: null,
      refundId: null,
    }
  }
  return { records, events: [], nextSequence: 1 }
}

/** Keep historical passenger rows; add new passengers and refresh names without resetting ledger state. */
export function syncLedgerPassengers(ledger: PassengerLedger, passengers: Passenger[]): PassengerLedger {
  let changed = false
  const records = { ...ledger.records }
  for (const passenger of passengers) {
    const existing = records[passenger.id]
    if (!existing) {
      records[passenger.id] = createPassengerLedger([passenger]).records[passenger.id]
      changed = true
    } else if (existing.passengerName !== passenger.name) {
      records[passenger.id] = { ...existing, passengerName: passenger.name }
      changed = true
    }
  }
  return changed ? { ...ledger, records } : ledger
}

function reject(ledger: PassengerLedger, message: string): LedgerTransitionResult {
  return { ok: false, duplicate: false, message, ledger }
}

export function applyLedgerEvent(ledger: PassengerLedger, event: PassengerLedgerEvent): LedgerTransitionResult {
  const priorEvent = ledger.events.find((candidate) => candidate.eventId === event.eventId)
  if (priorEvent) {
    if (JSON.stringify(priorEvent) === JSON.stringify(event)) return { ok: true, duplicate: true, message: 'Duplicate simulated event ignored.', ledger }
    return reject(ledger, 'Event ID already exists with different data.')
  }
  if (event.simulated !== true) return reject(ledger, 'Only explicitly simulated ledger events are accepted.')
  const current = ledger.records[event.passengerId]
  if (!current) return reject(ledger, 'Passenger ledger record was not found.')
  if (event.amountPaise !== undefined && !validPaise(event.amountPaise)) return reject(ledger, 'Money amounts must be non-negative integer paise within the safe integer range.')

  let updated: PassengerTicketLedgerRecord = current
  switch (event.type) {
    case 'cancellation-requested':
      if (current.cancellationState !== 'none') return reject(ledger, 'A cancellation request can only be made once from the none state.')
      updated = { ...current, cancellationState: 'requested' }
      break
    case 'cancellation-accepted':
      if (current.cancellationState !== 'requested') return reject(ledger, 'Cancellation acceptance requires a pending cancellation request.')
      updated = { ...current, cancellationState: 'accepted' }
      break
    case 'cancellation-rejected':
      if (current.cancellationState !== 'requested') return reject(ledger, 'Cancellation rejection requires a pending cancellation request.')
      updated = { ...current, cancellationState: 'rejected' }
      break
    case 'refund-initiated': {
      if (current.cancellationState !== 'accepted') return reject(ledger, 'Refund initiation requires an accepted simulated cancellation request.')
      if (current.refundState !== 'not-started') return reject(ledger, 'This passenger already has a refund attempt; another cannot be initiated.')
      if (!event.refundId || event.amountPaise === undefined || event.amountPaise <= 0) return reject(ledger, 'Refund initiation requires a unique refund ID and a positive amount in paise.')
      if (event.amountPaise > current.paidAmountPaise) return reject(ledger, 'Refund amount cannot exceed the passenger’s recorded paid amount.')
      if (Object.values(ledger.records).some((record) => record.refundId === event.refundId)) return reject(ledger, 'Refund ID is already associated with another passenger record.')
      updated = { ...current, refundState: 'initiated', refundAmountPaise: event.amountPaise, refundId: event.refundId }
      break
    }
    case 'refund-processing':
      if (current.refundState !== 'initiated') return reject(ledger, 'Refund processing requires an initiated refund.')
      if (!sameRefundAmount(current, event)) return reject(ledger, 'Refund amount or ID changed after initiation.')
      updated = { ...current, refundState: 'processing' }
      break
    case 'refund-credited':
      if (current.refundState !== 'processing') return reject(ledger, 'Credit confirmation requires a refund in processing state.')
      if (!sameRefundAmount(current, event)) return reject(ledger, 'Refund amount or ID changed after initiation.')
      updated = { ...current, refundState: 'credited' }
      break
    case 'refund-rejected':
      if (!['initiated', 'processing'].includes(current.refundState)) return reject(ledger, 'Refund rejection requires an initiated or processing refund.')
      if (!sameRefundAmount(current, event)) return reject(ledger, 'Refund amount or ID changed after initiation.')
      updated = { ...current, refundState: 'rejected' }
      break
    case 'refund-failed':
      if (!['initiated', 'processing'].includes(current.refundState)) return reject(ledger, 'Refund failure can only be recorded for an initiated or processing refund.')
      if (!sameRefundAmount(current, event)) return reject(ledger, 'Refund amount or ID changed after initiation.')
      updated = { ...current, refundState: 'failed' }
      break
  }

  return {
    ok: true,
    duplicate: false,
    message: `Simulated ${event.type.replaceAll('-', ' ')} recorded.`,
    ledger: {
      ...ledger,
      records: { ...ledger.records, [event.passengerId]: updated },
      events: [...ledger.events, event],
      nextSequence: ledger.nextSequence + 1,
    },
  }
}

function sameRefundAmount(record: PassengerTicketLedgerRecord, event: PassengerLedgerEvent): boolean {
  return event.refundId === record.refundId && event.amountPaise === record.refundAmountPaise
}

export function createLedgerEvent(ledger: PassengerLedger, passengerId: string, type: PassengerLedgerEvent['type'], options: { refundId?: string; amountPaise?: number } = {}): PassengerLedgerEvent {
  return {
    eventId: `demo-ledger-event-${ledger.nextSequence}`,
    passengerId,
    type,
    ...(options.refundId ? { refundId: options.refundId } : {}),
    ...(options.amountPaise !== undefined ? { amountPaise: options.amountPaise } : {}),
    occurredAt: new Date(LEDGER_EPOCH + ledger.nextSequence * 60000).toISOString(),
    simulated: true,
  }
}

export function reconcileRefundCredits(ledger: PassengerLedger): RefundReconciliation {
  const creditedRecords = Object.values(ledger.records).filter((record) => record.refundState === 'credited')
  const uniqueRefundIds = new Set(creditedRecords.map((record) => record.refundId).filter((id): id is string => id !== null))
  const creditedAmountPaise = creditedRecords.reduce((sum, record) => sum + (record.refundAmountPaise ?? 0), 0)
  const recordedCreditedAmountPaise = ledger.events
    .filter((event) => event.type === 'refund-credited' && event.refundId && uniqueRefundIds.has(event.refundId))
    .reduce((sum, event, index, events) => {
      const first = events.findIndex((candidate) => candidate.refundId === event.refundId)
      return first === index ? sum + (event.amountPaise ?? 0) : sum
    }, 0)
  return { creditedRefundCount: uniqueRefundIds.size, creditedAmountPaise, recordedCreditedAmountPaise, matches: creditedAmountPaise === recordedCreditedAmountPaise }
}
