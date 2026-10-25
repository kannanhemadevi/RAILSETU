import { useEffect, useState } from 'react'
import type { Passenger } from '../types/journey.ts'
import type { LedgerEventType, PassengerLedger as PassengerLedgerState } from '../types/ledger.ts'
import { applyLedgerEvent, createLedgerEvent, createPassengerLedger, reconcileRefundCredits, syncLedgerPassengers } from '../engine/passengerLedger.ts'

const STORAGE_KEY = 'railsetu-passenger-ledger-v1'

function loadLedger(passengers: Passenger[]) {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved) as PassengerLedgerState
  } catch { /* create a clean synthetic ledger when storage is unavailable */ }
  return createPassengerLedger(passengers)
}

function formatPaise(amount: number): string {
  const rupees = Math.floor(amount / 100)
  const paise = String(amount % 100).padStart(2, '0')
  return `₹${rupees.toLocaleString('en-IN')}.${paise}`
}

function parseRupeesToPaise(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim())
  if (!match) return null
  const paise = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0')
  return paise <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(paise) : null
}

export function PassengerLedger({ passengers }: { passengers: Passenger[] }) {
  const [storedLedger, setStoredLedger] = useState(() => loadLedger(passengers))
  const [amounts, setAmounts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')
  const ledger = syncLedgerPassengers(storedLedger, passengers)
  const reconciliation = reconcileRefundCredits(ledger)
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ledger)) } catch { /* local persistence is optional */ } }, [ledger])

  function dispatch(passengerId: string, type: LedgerEventType, refundId?: string, amountPaise?: number) {
    const event = createLedgerEvent(ledger, passengerId, type, { refundId, amountPaise })
    const result = applyLedgerEvent(ledger, event)
    setStoredLedger(result.ledger)
    setMessage(result.message)
  }

  function dispatchInitiation(passengerId: string) {
    const amountPaise = parseRupeesToPaise(amounts[passengerId] ?? '1000.00')
    if (amountPaise === null) { setMessage('Enter a valid amount with up to two decimal places.'); return }
    dispatch(passengerId, 'refund-initiated', `demo-refund-${passengerId}`, amountPaise)
  }

  return <section className="passenger-ledger" aria-labelledby="ledger-heading">
    <div className="ledger-heading"><div><span className="section-index">SIMULATED LEDGER</span><h3 id="ledger-heading">Ticket &amp; refund activity</h3><p>Each passenger has an independent demo record. No real ticket or refund is processed.</p></div><div className={`reconciliation ${reconciliation.matches ? 'matched' : 'unmatched'}`}>{reconciliation.matches ? 'RECONCILED' : 'CHECK REQUIRED'}</div></div>
    <div className="ledger-rows">{passengers.map((passenger) => {
      const record = ledger.records[passenger.id]
      if (!record) return null
      return <article className="ledger-row" key={passenger.id}>
        <div className="ledger-person"><b>{passenger.name}</b><small>{record.syntheticTicketId} · SIMULATED</small></div>
        <div className="ledger-states"><span>Cancellation <b>{record.cancellationState}</b></span><span>Refund <b>{record.refundState}</b></span></div>
        <div className="ledger-money"><span>Paid demo amount <b>{formatPaise(record.paidAmountPaise)}</b></span>{record.refundAmountPaise !== null && <span>Refund <b>{formatPaise(record.refundAmountPaise)}</b></span>}</div>
        <div className="ledger-actions">
          {record.cancellationState === 'none' && <button type="button" onClick={() => dispatch(passenger.id, 'cancellation-requested')}>Request simulated cancellation</button>}
          {record.cancellationState === 'requested' && <><button type="button" onClick={() => dispatch(passenger.id, 'cancellation-accepted')}>Accept request</button><button className="secondary" type="button" onClick={() => dispatch(passenger.id, 'cancellation-rejected')}>Reject request</button></>}
          {record.cancellationState === 'accepted' && record.refundState === 'not-started' && <><label>Refund amount (₹)<input inputMode="decimal" value={amounts[passenger.id] ?? '1000.00'} onChange={(event) => setAmounts((current) => ({ ...current, [passenger.id]: event.target.value }))} aria-label={`Simulated refund amount for ${passenger.name}`} /></label><button type="button" onClick={() => dispatchInitiation(passenger.id)}>Initiate simulated refund</button></>}
          {record.refundState === 'initiated' && <button type="button" onClick={() => dispatch(passenger.id, 'refund-processing', record.refundId ?? undefined, record.refundAmountPaise ?? undefined)}>Mark processing</button>}
          {record.refundState === 'processing' && <><button type="button" onClick={() => dispatch(passenger.id, 'refund-credited', record.refundId ?? undefined, record.refundAmountPaise ?? undefined)}>Confirm simulated credit</button><button className="secondary" type="button" onClick={() => dispatch(passenger.id, 'refund-rejected', record.refundId ?? undefined, record.refundAmountPaise ?? undefined)}>Reject refund</button><button className="secondary" type="button" onClick={() => dispatch(passenger.id, 'refund-failed', record.refundId ?? undefined, record.refundAmountPaise ?? undefined)}>Mark failed</button></>}
        </div>
      </article>
    })}</div>
    <div className="ledger-reconcile"><span>Credited demo refunds: {reconciliation.creditedRefundCount}</span><b>{formatPaise(reconciliation.creditedAmountPaise)}</b><small>Final credit reconciliation {reconciliation.matches ? 'matches' : 'does not match'} the ledger.</small></div>
    {message && <p className="ledger-message" role="status">{message}</p>}
  </section>
}
