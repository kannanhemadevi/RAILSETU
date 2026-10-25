import { useEffect, useRef, useState } from 'react'
import { answerAssistant, assistantLabel, assistantSuggestedPrompts, assistantUi } from '../engine/assistant.ts'
import { detectVoiceCapabilities } from '../engine/voiceSupport.ts'
import { languageDirection, languageOptions } from '../i18n.ts'
import type { AssistantAction, AssistantContext } from '../engine/assistant.ts'
import type { Language } from '../i18n.ts'
import './VoiceAssistant.css'

type RecognitionResult = { 0: { transcript: string }; isFinal: boolean }
type RecognitionEvent = { resultIndex: number; results: ArrayLike<RecognitionResult> }
type RecognitionLike = {
  lang: string; continuous: boolean; interimResults: boolean
  onresult: ((event: RecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void; stop: () => void; abort: () => void
}
type RecognitionConstructor = new () => RecognitionLike
type SpeechWindow = Window & { SpeechRecognition?: RecognitionConstructor; webkitSpeechRecognition?: RecognitionConstructor }
type ChatMessage = { id: number; role: 'assistant' | 'user'; text: string; action?: AssistantAction }

const speechTags: Record<Language, string> = { en:'en-IN', hi:'hi-IN', bn:'bn-IN', mr:'mr-IN', te:'te-IN', ta:'ta-IN', ur:'ur-IN' }
export function VoiceAssistant({ context, onNavigate, onChangeLanguage }: { context: AssistantContext; onNavigate: (action: AssistantAction) => void; onChangeLanguage: (language: Language) => void }) {
  const language = context.language
  const t = (key: keyof typeof assistantUi.en, values?: Record<string, string>) => assistantLabel(language, key, values)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [voiceStatus, setVoiceStatus] = useState('')
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const recognition = useRef<RecognitionLike | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const capabilities = detectVoiceCapabilities(window as SpeechWindow)

  useEffect(() => { if (open && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages, open])
  useEffect(() => () => { recognition.current?.abort(); window.speechSynthesis?.cancel() }, [])

  function submit(text = draft) {
    const clean = text.trim()
    if (!clean) return
    setMessages((items) => [...items, { id: Date.now(), role: 'user', text: clean }])
    const response = answerAssistant(clean, context)
    setMessages((items) => [...items, { id: Date.now() + 1, role: 'assistant', text: response.text, action: response.action }])
    setDraft('')
    setVoiceStatus('')
  }
  function startListening() {
    const speechWindow = window as SpeechWindow
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Constructor) { setVoiceStatus(t('unsupported')); return }
    try {
      recognition.current?.abort()
      const instance = new Constructor()
      instance.lang = speechTags[language]; instance.continuous = false; instance.interimResults = true
      instance.onresult = (event) => {
        const transcript = Array.from(event.results).map((result) => result[0]?.transcript ?? '').join('')
        if (transcript) setDraft(transcript)
      }
      instance.onerror = (event) => {
        setListening(false)
        setVoiceStatus(event.error === 'not-allowed' || event.error === 'service-not-allowed' ? t('denied') : event.error === 'language-not-supported' ? t('noLanguageRecognition') : t('error'))
      }
      instance.onend = () => { setListening(false); recognition.current = null }
      recognition.current = instance; setListening(true); setVoiceStatus(t('listening')); instance.start()
    } catch { setListening(false); setVoiceStatus(t('error')) }
  }
  function stopListening() { recognition.current?.stop(); setListening(false); setVoiceStatus(t('edit')) }
  function stopSpeaking() { window.speechSynthesis?.cancel(); setSpeaking(false); setVoiceStatus(t('stopped')) }
  function speak(text: string) {
    if (!('speechSynthesis' in window)) { setVoiceStatus(t('unsupported')); return }
    const voices = window.speechSynthesis.getVoices()
    const voice = voices.find((candidate) => candidate.lang.toLowerCase().startsWith(speechTags[language].slice(0, 2)))
    if (!voice) { setVoiceStatus(t('noVoice')); return }
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = speechTags[language]; utterance.voice = voice
    utterance.onstart = () => { setSpeaking(true); setVoiceStatus(t('speaking')) }
    utterance.onend = () => { setSpeaking(false); setVoiceStatus(t('stopped')) }
    utterance.onerror = () => { setSpeaking(false); setVoiceStatus(t('error')) }
    window.speechSynthesis.speak(utterance)
  }
  function runAction(action: AssistantAction) {
    if (action === 'language') {
      document.getElementById('language-select')?.focus()
      return
    }
    onNavigate(action)
  }

  return <>
    <button className="assistant-launcher" type="button" aria-label={t('open')} aria-expanded={open} onClick={() => setOpen((value) => !value)}><span aria-hidden="true">✦</span><span>RAILSETU</span></button>
    {open && <section className="assistant-panel" lang={language} dir={languageDirection(language)} aria-label={t('title')}>
      <header className="assistant-header"><div><b>{t('title')}</b><small>{t('builtIn')}</small></div><button type="button" className="assistant-close" onClick={() => setOpen(false)} aria-label={t('close')}>×</button></header>
      <div className="assistant-context"><span>{t('current', { page: context.page })}</span><label><span className="sr-only">{t('languageSelect')}</span><select value={language} aria-label={t('languageSelect')} onChange={(event) => onChangeLanguage(event.target.value as Language)}>{languageOptions.map((option) => <option key={option.code} value={option.code}>{option.nativeName} — {option.englishName}</option>)}</select></label></div>
      <div className="assistant-messages" ref={scrollRef} aria-live="polite">
        {messages.length === 0 && <div className="assistant-welcome"><p>{answerAssistant('', context).text}</p><div className="assistant-suggestions">{assistantSuggestedPrompts(language).map((prompt) => <button key={prompt} type="button" onClick={() => submit(prompt)}>{prompt}</button>)}</div></div>}
        {messages.map((message) => <article className={'assistant-message '+message.role} key={message.id}><p>{message.text}</p>{message.action && <button className="assistant-action" type="button" onClick={() => runAction(message.action!)}>{t('go')} →</button>}{message.role === 'assistant' && <button type="button" className="assistant-speak" disabled={!capabilities.synthesis} onClick={() => speaking ? stopSpeaking() : speak(message.text)}>{speaking ? t('stopSpeaking') : t('speak')}</button>}</article>)}
      </div>
      <div className="assistant-compose"><textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={t('placeholder')} aria-label={t('placeholder')} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} />
        <div className="assistant-controls"><button className="assistant-mic" type="button" aria-label={listening ? t('listening') : t('mic')} disabled={listening} onClick={startListening}>{listening ? '●' : '🎙'}</button>{listening && <button className="assistant-stop" type="button" onClick={stopListening}>{t('stopListening')}</button>}<button className="assistant-send" type="button" disabled={!draft.trim()} onClick={() => submit()}>{t('send')}</button></div>
        {!capabilities.synthesis && <p className="assistant-voice-status" role="status">{t('synthesisUnavailable')}</p>}
        {voiceStatus && <p className="assistant-voice-status" role="status">{voiceStatus}</p>}{!capabilities.recognition && !voiceStatus && <p className="assistant-voice-status" role="status">{t('unsupported')}</p>}
      </div>
    </section>}
  </>
}

