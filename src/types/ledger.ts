export type CancellationState = 'none' | 'requested' | 'accepted' | 'rejected'
export type RefundState = 'not-started' | 'initiated' | 'processing' | 'credited' | 'rejected' | 'failed'

export type PassengerTicketLedgerRecord = {
  passengerId: string
  passengerName: string
  syntheticTicketId: string
  ticketState: 'confirmed-demo' | 'held-demo'
  cancellationState: CancellationState
  refundState: RefundState
  paidAmountPaise: number
  refundAmountPaise: number | null
  refundId: string | null
}

export type LedgerEventType =
  | 'cancellation-requested'
  | 'cancellation-accepted'
  | 'cancellation-rejected'
  | 'refund-initiated'
  | 'refund-processing'
  | 'refund-credited'
  | 'refund-rejected'
  | 'refund-failed'

export type PassengerLedgerEvent = {
  eventId: string
  passengerId: string
  type: LedgerEventType
  refundId?: string
  amountPaise?: number
  occurredAt: string
  simulated: true
}

export type PassengerLedger = {
  records: Record<string, PassengerTicketLedgerRecord>
  events: PassengerLedgerEvent[]
  nextSequence: number
}

export type LedgerTransitionResult =
  | { ok: true; duplicate: boolean; message: string; ledger: PassengerLedger }
  | { ok: false; duplicate: false; message: string; ledger: PassengerLedger }

export type RefundReconciliation = {
  creditedRefundCount: number
  creditedAmountPaise: number
  recordedCreditedAmountPaise: number
  matches: boolean
}
