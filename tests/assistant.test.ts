import assert from 'node:assert/strict'
import test from 'node:test'
import { answerAssistant, assistantLabel, assistantSuggestedPrompts, type AssistantContext } from '../src/engine/assistant.ts'
import { detectVoiceCapabilities } from '../src/engine/voiceSupport.ts'
import { languageOptions } from '../src/i18n.ts'
import { planJourney, planJourneyDetailed } from '../src/engine/planJourney.ts'
import { buildRouteInsight } from '../src/engine/routeInsights.ts'

const routes = planJourney({ origin: 'NDLS', destination: 'AGC', date: '2030-01-01', time: '06:00', passengers: 1 })
const detailed = planJourneyDetailed({ origin: 'NDLS', destination: 'AGC', date: '2030-01-01', time: '06:00', passengers: 1 })
const selectedRoute = routes.find((route) => route.transferCount > 0)
const context: AssistantContext = { language: 'en', page: 'Journey Results', originName: 'New Delhi', destinationName: 'Agra', routes, selectedRoute, selectedDecision: detailed.decisions.find((decision) => decision.itineraryId === selectedRoute?.id), passengerCount: 1, passengerNames: ['Demo Passenger'], bookingCount: 1, latestBookingReference: 'RAILSETU-DEMO-00001', refundStatusByPassenger: [{ passengerId: 'p1', refundState: 'processing', cancellationState: 'accepted' }] }

test('built-in assistant compares actual generated routes and navigates to existing ticket records', () => {
  const comparison = answerAssistant('Compare my available routes', context)
  assert.match(comparison.text, /DEMO-/)
  assert.match(comparison.text, /synthetic fare/)
  const tickets = answerAssistant('Where can I find my tickets?', context)
  assert.equal(tickets.action, 'tickets')
  assert.match(tickets.text, /RAILSETU-DEMO-00001/)
})

test('assistant uses current transfer values and never invents a route when none exists', () => {
  const risk = answerAssistant('Explain the connection risk', context)
  assert.match(risk.text, /minimum/)
  assert.match(risk.text, /minutes remain/)
  const empty = answerAssistant('Compare my available routes', { ...context, routes: [], selectedRoute: undefined })
  assert.equal(empty.action, 'dashboard')
  assert.match(empty.text, /no generated routes/i)
})

test('assistant labels and suggestions exist in all seven supported languages', () => {
  for (const option of languageOptions) {
    assert.ok(assistantLabel(option.code, 'builtIn').length > 10)
    const prompts = assistantSuggestedPrompts(option.code)
    assert.equal(prompts.length, 5)
    assert.equal(answerAssistant(prompts[0]!, { ...context, language: option.code }).action, 'dashboard')
    assert.match(answerAssistant(prompts[1]!, { ...context, language: option.code }).text, /1\./)
    assert.ok(answerAssistant(prompts[2]!, { ...context, language: option.code }).text.length > 8)
    assert.equal(answerAssistant(prompts[3]!, { ...context, language: option.code }).action, 'tickets')
    assert.equal(answerAssistant(prompts[4]!, { ...context, language: option.code }).action, 'language')
  }
})

test('route-result insight distinguishes direct trips from real connecting itinerary margins', () => {
  const generated = planJourney({ origin: 'NDLS', destination: 'AGC', date: '2030-01-01', time: '06:00', passengers: 1 })
  const direct = generated.find((route) => route.transferCount === 0)!
  const connecting = generated.find((route) => route.transferCount > 0)!
  assert.equal(buildRouteInsight(direct).kind, 'direct')
  const insight = buildRouteInsight(connecting)
  assert.equal(insight.kind, 'connecting')
  if (insight.kind === 'connecting') {
    assert.equal(insight.connections.length, connecting.transferCount)
    assert.equal(insight.connections[0]?.scheduledMinutes, connecting.bufferMinutes[0])
  }
})

test('voice capability detection handles missing browser APIs and supported recognition/synthesis', () => {
  assert.deepEqual(detectVoiceCapabilities({}), { recognition: false, synthesis: false })
  assert.deepEqual(detectVoiceCapabilities({ webkitSpeechRecognition: function () {}, speechSynthesis: {} }), { recognition: true, synthesis: true })
})
