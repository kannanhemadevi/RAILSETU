export type JourneyPreferences = { reliability: number; comfort: number; speed: number }
import type { RankingWeights } from '../types/decision.ts'

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

const defaultRankingWeights: RankingWeights = { arrivalTimeRisk: 30, connectionRisk: 30, fare: 20, confirmationUncertainty: 10, accessibilityPreference: 10 }

export function resolveRankingWeights(weights: RankingWeights): RankingWeights {
  const values = Object.values(weights)
  if (values.some((value) => !Number.isFinite(value) || value < 0) || values.every((value) => value === 0)) return { ...defaultRankingWeights }
  return { ...weights }
}

export function normalizeRankingWeights(weights: RankingWeights): RankingWeights {
  const resolved = resolveRankingWeights(weights)
  const total = Object.values(resolved).reduce((sum, weight) => sum + weight, 0)
  return Object.fromEntries(Object.entries(resolved).map(([key, value]) => [key, value / total * 100])) as unknown as RankingWeights
}
