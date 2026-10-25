import type { ItineraryDecision } from '../types/decision.ts'
import type { JourneyOption, Passenger } from '../types/journey.ts'

export function buildJourneyPack(option: JourneyOption, passengers: Passenger[], decision?: ItineraryDecision): string {
  const legs = option.legs.map((leg, index) => {
    const transfer = index > 0 ? `\n  Transfer at ${option.legs[index - 1].to.name}: ${option.bufferMinutes[index - 1]} minutes` : ''
    const station = (value: typeof leg.from) => value.name + (value.code ? ' (' + value.code + ')' : ' · ' + value.city + ', ' + value.stateOrUT)
    return `${index + 1}. ${leg.service.id} (${leg.service.classLabel})\n  ${station(leg.from)} — ${leg.departAt.toLocaleString()} → ${station(leg.to)} — ${leg.arriveAt.toLocaleString()}${transfer}`
  }).join('\n')
  const scoring = decision?.scoreExplanations.map((factor) => `- ${factor.factor}: input ${factor.inputValue ?? 'missing'}, normalized ${factor.normalizedScore}/100, weight ${factor.weight}, contribution ${factor.weightedContribution.toFixed(2)}. ${factor.explanation}`).join('\n') ?? option.reasons.map((reason) => `- ${reason}`).join('\n')
  const feasibility = decision?.explanations.map((explanation) => `- ${explanation.status}: ${explanation.message}`).join('\n') ?? 'Synthetic journey candidate accepted by planner.'
  const rejections = decision?.rejectionReasons.length ? decision.rejectionReasons.map((reason) => `- ${reason.message}`).join('\n') : 'None for this selected route.'
  return [
    '# RAILSETU Journey Pack',
    '',
    '> SYNTHETIC DEMO ONLY. Schedules, fares, passenger ticket states, risks, and disruption assumptions are illustrative fixtures. This is not live railway information, a booking, or operational advice.',
    '',
    `## Selected itinerary: ${option.id}`,
    `- Departure: ${option.departure.toLocaleString()}`,
    `- Arrival: ${option.arrival.toLocaleString()}`,
    `- Duration: ${option.durationMinutes} minutes`,
    `- Transfers: ${option.transferCount}`,
    `- Illustrative synthetic fare: ₹${option.fare.toFixed(2)}`,
    `- Synthetic risk indicator: ${option.risk}/100`,
    `- Decision score: ${decision?.score ?? option.score}/100`,
    '',
    '## Passengers',
    ...passengers.map((passenger, index) => `${index + 1}. ${passenger.name} (${passenger.category})`),
    '',
    '## Train legs and connections',
    legs || 'No legs available.',
    '',
    '## Feasibility and decision explanations',
    feasibility,
    '',
    '## Scoring factors',
    scoring || 'No scoring factors available.',
    '',
    '## Rejection reasons',
    rejections,
    '',
    '## Assumptions and provenance',
    '- All services, times, fares, accessibility features, and risk values come from local synthetic demo fixtures.',
    '- Connections are evaluated using station matching and passenger/group transfer requirements.',
    '- No railway system was contacted and no ticket was booked or cancelled.',
  ].join('\n')
}

export function downloadJourneyPack(content: string, itineraryId: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `railsetu-${itineraryId}-journey-pack.md`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
