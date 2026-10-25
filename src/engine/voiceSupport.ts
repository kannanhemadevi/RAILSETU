export type VoiceCapabilities = { recognition: boolean; synthesis: boolean }
export function detectVoiceCapabilities(environment: { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown; speechSynthesis?: unknown }): VoiceCapabilities {
  return { recognition: typeof environment.SpeechRecognition === 'function' || typeof environment.webkitSpeechRecognition === 'function', synthesis: Boolean(environment.speechSynthesis) }
}
