import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  LoaderCircle,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Volume2,
  VolumeX,
  Wrench,
} from 'lucide-react'
import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import type { ChatMessage, VitalDiagnosis } from '../types'

type SpeechRecognitionEventLike = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
    }
  }
}

type SpeechRecognitionErrorEventLike = Event & {
  error: string
}

type SpeechRecognitionLike = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onstart: (() => void) | null
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

type AnalysisResultProps = {
  diagnosis: VitalDiagnosis
  imageUrl: string
  problem: string
  category: string
  onNewInspection: () => void
  onEdit: () => void
}

function createSpokenSummary(diagnosis: VitalDiagnosis): string {
  const observations = diagnosis.visibleObservations.slice(0, 3).join('. ')
  const checks = diagnosis.safeChecks.slice(0, 3).join('. ')
  const safetyText =
    diagnosis.safetyLevel === 'STOP'
      ? 'Stop using the equipment and contact a qualified professional.'
      : diagnosis.safetyLevel === 'CAUTION'
        ? 'Proceed carefully and stop if conditions become unsafe.'
        : 'The visible risk level appears low, but continue carefully.'

  return `${diagnosis.equipment}. ${diagnosis.summary}. ${safetyText} Visible observations: ${observations}. Safe checks: ${checks}.`
}

function safetyLabel(level: VitalDiagnosis['safetyLevel']) {
  if (level === 'STOP') return 'Stop and get help'
  if (level === 'CAUTION') return 'Proceed with caution'
  return 'Low visible risk'
}

export default function AnalysisResult({
  diagnosis,
  imageUrl,
  problem,
  category,
  onNewInspection,
  onEdit,
}: AnalysisResultProps) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [chatError, setChatError] = useState('')

  const speechSupported = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  const synthesisSupported = 'speechSynthesis' in window

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort()
      window.speechSynthesis?.cancel()
    }
  }, [])

  const speak = (text: string) => {
    if (!synthesisSupported || !voiceEnabled) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.96
    utterance.pitch = 1
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
  }

  const toggleListening = () => {
    if (!speechSupported) {
      setChatError('Voice input is not supported in this browser. Chrome or Edge works best.')
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!Recognition) return

    const recognition = new Recognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-IN'
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() ?? ''
      if (transcript) setQuestion(transcript)
    }
    recognition.onerror = (event) => {
      setChatError(
        event.error === 'not-allowed'
          ? 'Microphone permission was blocked. Allow microphone access and try again.'
          : 'VITAL could not hear you clearly. Please try again.',
      )
      setIsListening(false)
    }
    recognition.onend = () => setIsListening(false)
    recognitionRef.current = recognition
    setChatError('')
    setIsListening(true)
    recognition.start()
  }

  const sendQuestion = async (event: FormEvent) => {
    event.preventDefault()
    const trimmedQuestion = question.trim()
    if (!trimmedQuestion || isSending) return

    const userMessage: ChatMessage = { role: 'user', text: trimmedQuestion }
    const nextMessages = [...messages, userMessage]
    setMessages(nextMessages)
    setQuestion('')
    setChatError('')
    setIsSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          diagnosis,
          problem,
          category,
          question: trimmedQuestion,
          history: messages.slice(-6),
        }),
      })

      const payload = (await response.json()) as { answer?: string; error?: string }
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || 'VITAL could not answer that question.')
      }

      const assistantMessage: ChatMessage = { role: 'assistant', text: payload.answer }
      setMessages([...nextMessages, assistantMessage])
      speak(payload.answer)
    } catch (error) {
      setChatError(error instanceof Error ? error.message : 'VITAL could not answer that question.')
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="analysis-page max-w-7xl mx-auto">
      <div className="analysis-topbar">
        <button onClick={onEdit} className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white transition-colors">
          <ArrowLeft size={16} /> Edit inspection
        </button>
        <button onClick={onNewInspection} className="secondary-action">New inspection</button>
      </div>

      <div className="analysis-hero-grid">
        <div>
          <p className="eyebrow"><Sparkles size={14} /> Visual analysis complete</p>
          <h1 className="inspection-title">VITAL found a safe place to start.</h1>
          <p className="inspection-subtitle">This report is based on the visible photo and the problem you described. It is not a certified repair diagnosis.</p>
        </div>

        <div className={`safety-result safety-result-${diagnosis.safetyLevel.toLowerCase()}`}>
          {diagnosis.safetyLevel === 'STOP' ? <ShieldAlert size={25} /> : <ShieldCheck size={25} />}
          <div>
            <span>Safety level</span>
            <strong>{safetyLabel(diagnosis.safetyLevel)}</strong>
          </div>
        </div>
      </div>

      <div className="analysis-main-grid">
        <section className="inspection-card analysis-image-card">
          <img src={imageUrl} alt="Analysed equipment" className="analysis-image" />
          <div className="analysis-scan-overlay" />
          <div className="analysis-image-badge"><Bot size={15} /> AI visual review</div>
        </section>

        <section className="inspection-card analysis-summary-card">
          <div className="analysis-equipment-row">
            <div>
              <span>Detected equipment</span>
              <h2>{diagnosis.equipment}</h2>
            </div>
            <div className="confidence-ring" style={{ '--confidence': `${diagnosis.confidence * 3.6}deg` } as CSSProperties}>
              <span>{diagnosis.confidence}%</span>
            </div>
          </div>
          <p className="analysis-summary">{diagnosis.summary}</p>
          <div className="analysis-meta-grid">
            <div><span>Selected category</span><strong>{category}</strong></div>
            <div><span>Professional help</span><strong>{diagnosis.professionalHelpRequired ? 'Recommended' : 'Not immediately required'}</strong></div>
          </div>
          {diagnosis.professionalHelpRequired && (
            <div className="professional-warning">
              <AlertTriangle size={19} />
              <p>{diagnosis.professionalHelpReason}</p>
            </div>
          )}
          <button onClick={() => speak(createSpokenSummary(diagnosis))} className="speak-report-button" disabled={!synthesisSupported}>
            <Volume2 size={18} /> Hear VITAL explain this report
          </button>
        </section>
      </div>

      <div className="analysis-report-grid">
        <ReportCard title="Visible observations" icon={<CheckCircle2 size={19} />} items={diagnosis.visibleObservations} />
        <section className="inspection-card report-card">
          <div className="report-card-title"><Wrench size={19} /><h3>Possible causes</h3></div>
          <div className="cause-list">
            {diagnosis.possibleCauses.map((item, index) => (
              <div key={`${item.cause}-${index}`} className="cause-item">
                <span>{String(index + 1).padStart(2, '0')}</span>
                <p>{item.cause}</p>
                <strong>{item.likelihood}</strong>
              </div>
            ))}
          </div>
        </section>
        <ReportCard title="Safe checks to try" icon={<ShieldCheck size={19} />} items={diagnosis.safeChecks} numbered />
        <ReportCard title="Stop immediately when" icon={<ShieldAlert size={19} />} items={diagnosis.stopConditions} warning />
      </div>

      <section className="inspection-card talk-card">
        <div className="talk-card-heading">
          <div>
            <p className="eyebrow"><Bot size={14} /> Talk to VITAL</p>
            <h2>Ask a follow-up question by voice or text.</h2>
            <p>VITAL answers from this inspection report and keeps safety limits active.</p>
          </div>
          <button
            onClick={() => {
              setVoiceEnabled((current) => !current)
              window.speechSynthesis?.cancel()
            }}
            className={voiceEnabled ? 'voice-toggle voice-toggle-active' : 'voice-toggle'}
            title={voiceEnabled ? 'Spoken replies are on' : 'Spoken replies are off'}
          >
            {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {voiceEnabled ? 'Voice on' : 'Voice off'}
          </button>
        </div>

        <div className="chat-window">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <Bot size={23} />
              <p>Try asking: “Which safe check should I do first?”</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`chat-message chat-message-${message.role}`}>
                <span>{message.role === 'assistant' ? 'VITAL' : 'YOU'}</span>
                <p>{message.text}</p>
              </div>
            ))
          )}
          {isSending && (
            <div className="chat-message chat-message-assistant chat-thinking">
              <span>VITAL</span>
              <p><LoaderCircle size={16} className="spin" /> Thinking safely…</p>
            </div>
          )}
        </div>

        <form onSubmit={sendQuestion} className="talk-input-row">
          <button
            type="button"
            onClick={toggleListening}
            className={isListening ? 'mic-button mic-button-active' : 'mic-button'}
            aria-label={isListening ? 'Stop listening' : 'Ask by voice'}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder={isListening ? 'Listening…' : 'Ask VITAL about this equipment…'}
            aria-label="Ask VITAL a follow-up question"
          />
          <button type="submit" className="send-question-button" disabled={!question.trim() || isSending}>
            <Send size={18} />
          </button>
        </form>

        {chatError && <div className="form-error mt-4">{chatError}</div>}
        {!speechSupported && <p className="voice-support-note">Voice input is unavailable in this browser, but text chat and spoken replies can still work.</p>}
      </section>

      <div className="safety-strip">
        <div className="safety-icon"><ShieldCheck size={22} /></div>
        <div>
          <strong>{diagnosis.disclaimer}</strong>
          <p>Never work on live electricity, gas, fire-damaged equipment, swollen batteries, moving machinery or safety-critical vehicle systems.</p>
        </div>
      </div>
    </div>
  )
}

type ReportCardProps = {
  title: string
  icon: ReactNode
  items: string[]
  numbered?: boolean
  warning?: boolean
}

function ReportCard({ title, icon, items, numbered = false, warning = false }: ReportCardProps) {
  return (
    <section className={`inspection-card report-card ${warning ? 'report-card-warning' : ''}`}>
      <div className="report-card-title">{icon}<h3>{title}</h3></div>
      <ul className={numbered ? 'report-list report-list-numbered' : 'report-list'}>
        {items.map((item, index) => (
          <li key={`${item}-${index}`}>
            <span>{numbered ? String(index + 1).padStart(2, '0') : ''}</span>
            <p>{item}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
