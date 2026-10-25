import type { Language, MessageKey } from '../i18n.ts'
import { translate } from '../i18n.ts'
import type { DemoBooking } from '../types/booking.ts'
import { journeyLegSelectionKey } from './trainSelection.ts'
import { mealPreferenceLabelKey } from './passengerPreferences.ts'

const clock = (value: Date) => value.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
const money = (paise: number) => '₹' + Math.floor(paise / 100).toLocaleString('en-IN') + '.' + String(paise % 100).padStart(2, '0')

/** Local, simulated ticket text only; the export is not a railway ticket or proof of reservation. */
export function buildDemoTicketText(booking: DemoBooking, language: Language): string {
  const t = (key: MessageKey) => translate(language, key)
  const legs = booking.itinerary.legs.map((leg, index) => {
    const key = journeyLegSelectionKey(booking.itinerary.id, index, leg.service.id)
    const selection = booking.classSelections[key]
    const option = leg.service.syntheticClasses?.find((item) => item.code === selection?.classCode)
    const preferences = booking.passengers.map((passenger) => `${passenger.name}: ${passenger.berthPreferences?.[key] ?? selection?.preferenceCode ?? '—'}`).join('; ')
    return `${index + 1}. ${leg.service.id} · ${leg.from.name} ${clock(leg.departAt)} → ${leg.to.name} ${clock(leg.arriveAt)} · ${option?.code ?? '—'} ${option?.name ?? ''} · ${preferences}`
  }).join('\n')
  const passengerDetails = booking.passengers.map((passenger) => {
    const assistance = passenger.passengerWithDisabilities
      ? passenger.carHelpPreference === 'yes' ? t('carHelpYes') : passenger.carHelpPreference === 'no' ? t('carHelpNo') : t('carHelpPending')
      : t('carHelpNo')
    return `${passenger.name} — ${t('ageLabel')}: ${passenger.age ?? '—'}; ${t('seniorCitizen')}: ${passenger.seniorCitizen ? t('yes') : t('no')}; ${t('mealPreferenceLabel')}: ${t(mealPreferenceLabelKey(passenger.mealPreference ?? 'no-meal'))}; ${t('disabilityLabel')}: ${passenger.passengerWithDisabilities ? t('carHelpYes') : t('carHelpNo')}; ${t('carHelpFor')}: ${assistance}`
  }).join('\n')
  return [
    t('confirmationText'), t('noTicketDisclaimer'),
    `${t('bookingReference')}: ${booking.reference}`,
    `${t('paymentStatus')}: ${booking.paymentStatus} via ${booking.paymentMethod}`,
    `${t('passengersLabel')}:`, passengerDetails,
    `${t('journey')}: ${booking.itinerary.legs[0]!.from.name} → ${booking.itinerary.legs.at(-1)!.to.name}`,
    `${t('demoFare')}: ${money(booking.fare.totalFarePaise)}`,
    `${t('legsClasses')}:`, legs, t('preferenceDemoNotice'),
  ].join('\n\n')
}
