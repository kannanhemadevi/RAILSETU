export type JourneyPreferences = { reliability: number; comfort: number; speed: number }

export function resolveJourneyPreferences(preferences: JourneyPreferences): JourneyPreferences {
  const values = [preferences.reliability, preferences.comfort, preferences.speed]
  if (values.some((value) => !Number.isFinite(value) || value < 0)) return { reliability: 1, comfort: 1, speed: 1 }
  if (values.every((value) => value === 0)) return { reliability: 1, comfort: 1, speed: 1 }
  return { ...preferences }
}

export function normalizeJourneyPreferences(preferences: JourneyPreferences): JourneyPreferences {
  const resolved = resolveJourneyPreferences(preferences)
  const total = resolved.reliability + resolved.comfort + resolved.speed
  return { reliability: resolved.reliability / total * 100, comfort: resolved.comfort / total * 100, speed: resolved.speed / total * 100 }
}
