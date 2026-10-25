import assert from 'node:assert/strict'
import test from 'node:test'
import { languageDirection, languageOptions, loadLanguagePreference, saveLanguagePreference, translate, translateExistingText, withLanguage } from '../src/i18n.ts'
import { pagePaths } from '../src/engine/appNavigation.ts'

function storage() {
  const data = new Map<string, string>()
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
  }
}

test('first-entry chooser offers seven native-script languages and persists a selection', () => {
  const store = storage()
  assert.equal(loadLanguagePreference(store), null)
  assert.deepEqual(languageOptions.map((option) => option.code), ['en', 'hi', 'bn', 'mr', 'te', 'ta', 'ur'])
  assert.deepEqual(languageOptions.map((option) => option.nativeName), ['English', 'हिन्दी', 'বাংলা', 'मराठी', 'తెలుగు', 'தமிழ்', 'اردو'])
  saveLanguagePreference(store, 'mr')
  assert.equal(loadLanguagePreference(store), 'mr')
})

test('switching language on every navigable page preserves journey and booking state', () => {
  const original = { language: 'en' as const, origin: 'NDLS', destination: 'JP', selectedRouteId: 'route-1', passengerName: 'Asha', bookingReference: 'DEMO-123' }
  for (const path of Object.values(pagePaths)) {
    for (const language of languageOptions.map((option) => option.code)) {
      const switched = withLanguage({ ...original, path }, language)
      assert.equal(switched.path, path)
      assert.equal(switched.origin, original.origin)
      assert.equal(switched.destination, original.destination)
      assert.equal(switched.selectedRouteId, original.selectedRouteId)
      assert.equal(switched.bookingReference, original.bookingReference)
      assert.equal(switched.language, language)
    }
  }
})

test('validation messages change with locale and Urdu selects RTL direction', () => {
  assert.notEqual(translate('hi', 'searchErrorSame'), translate('en', 'searchErrorSame'))
  assert.notEqual(translate('ur', 'searchErrorDate'), translate('en', 'searchErrorDate'))
  assert.equal(languageDirection('ur'), 'rtl')
  for (const code of ['en', 'hi', 'bn', 'mr', 'te', 'ta'] as const) assert.equal(languageDirection(code), 'ltr')
  for (const language of languageOptions.map((option) => option.code)) {
    for (const key of ['searchErrorStations', 'searchErrorSame', 'searchErrorDate', 'searchErrorPassengers'] as const) {
      assert.ok(translate(language, key).length > 0)
      if (language !== 'en') assert.notEqual(translate(language, key), translate('en', key))
    }
  }
  assert.equal(translateExistingText('en', 'hi', translate('en', 'searchErrorSame')), translate('hi', 'searchErrorSame'))
})

test('new tracking and passenger preference labels are translated for all seven locales', () => {
  assert.equal(translate('en','carHelpQuestion'),'Do you require CAR HELP / HELPER assistance to guide you during boarding and your train journey?')
  for (const language of languageOptions.map((option)=>option.code)) {
    for (const key of ['trackingTab','trackingDemoNotice','trackTrain','trackingUnavailable','coachPreference','mealVegetarian','mealNonVegetarian','mealJain','mealNone','disabilityLabel','carHelpQuestion','carHelpYes','carHelpNo','seniorBerthAuto'] as const) {
      assert.ok(translate(language,key).length > 0,`${language}:${key}`)
      if (language !== 'en') assert.notEqual(translate(language,key),translate('en',key),`${language}:${key} should be translated`)
    }
  }
  assert.equal(translate('ur','trackingTab').length > 0,true)
})
