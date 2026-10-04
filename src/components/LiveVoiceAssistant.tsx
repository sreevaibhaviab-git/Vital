import { Bot, LoaderCircle, Mic, MicOff, Sparkles, Volume2, X } from 'lucide-react'
import { useState } from 'react'
import { useVitalVoice } from '../hooks/useVitalVoice'

type LiveVoiceAssistantProps = {
  pageContext: 'landing' | 'inspection' | 'analysis'
  problem?: string
  category?: string
  onStartInspection?: () => void
  diagnosis?: unknown
}

function statusLabel(status: ReturnType<typeof useVitalVoice>['status']) {
  if (status === 'requesting') return 'Requesting microphone access…'
  if (status === 'recording') return 'Listening — tap again when finished'
  if (status === 'thinking') return 'Understanding your voice…'
  if (status === 'speaking') return 'VITAL is replying…'
  if (status === 'error') return 'Voice needs attention'
  return 'Tap the microphone and speak'
}

export default function LiveVoiceAssistant({
  pageContext,
  problem = '',
  category = '',
  onStartInspection,
  diagnosis,
}: LiveVoiceAssistantProps) {
  const [isOpen, setIsOpen] = useState(false)
  const voice = useVitalVoice({
    pageContext,
    problem,
    category,
    diagnosis,
    onStartInspection,
  })

  const handleOrbClick = () => {
    setIsOpen(true)
    voice.toggleRecording()
  }

  return (
    <div className={isOpen ? 'live-voice-wrap live-voice-wrap-open' : 'live-voice-wrap'}>
      {isOpen && (
        <section className="live-voice-panel" aria-label="VITAL voice assistant">
          <div className="live-voice-panel-head">
            <div className="live-voice-brand">
              <span className={`live-voice-mini-orb live-voice-mini-orb-${voice.status}`}>
                <Bot size={18} />
              </span>
              <div>
                <strong>VITAL Voice</strong>
                <small>{statusLabel(voice.status)}</small>
              </div>
            </div>
            <div className="live-voice-head-actions">
              <button
                type="button"
                onClick={() => voice.answer && voice.speak(voice.answer)}
                aria-label="Repeat VITAL response"
                title="Repeat response"
                disabled={!voice.answer}
              >
                <Volume2 size={15} />
              </button>
              <button
                type="button"
                onClick={() => {
                  voice.cancelVoice()
                  setIsOpen(false)
                }}
                aria-label="Close voice assistant"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          <div className="live-voice-visual">
            <div className={`live-wave live-wave-${voice.status}`} aria-hidden="true">
              {Array.from({ length: 7 }).map((_, index) => <i key={index} />)}
            </div>
            <p>
              {voice.isRecording
                ? 'Speak now. Say “Hi VITAL” or describe the equipment problem, then tap Stop.'
                : 'This version records one short voice message, understands it with Gemini and replies aloud.'}
            </p>
          </div>

          <div className="live-voice-transcript" aria-live="polite">
            {!voice.transcript && !voice.answer && (
              <p><Sparkles size={13} /> Your conversation will appear here.</p>
            )}
            {voice.transcript && (
              <div className="live-line live-line-user">
                <span>YOU</span>
                <p>{voice.transcript}</p>
              </div>
            )}
            {voice.answer && (
              <div className="live-line live-line-assistant">
                <span>VITAL</span>
                <p>{voice.answer}</p>
              </div>
            )}
          </div>

          {voice.error && <div className="live-voice-error">{voice.error}</div>}

          <button
            type="button"
            className={voice.isRecording ? 'live-voice-main-button live-voice-main-button-active' : 'live-voice-main-button'}
            onClick={voice.toggleRecording}
            disabled={voice.isBusy}
          >
            {voice.status === 'requesting' || voice.status === 'thinking' ? (
              <><LoaderCircle size={17} className="animate-spin" /> Please wait…</>
            ) : voice.isRecording ? (
              <><MicOff size={17} /> Stop and send</>
            ) : voice.status === 'speaking' ? (
              <><Volume2 size={17} /> VITAL is speaking…</>
            ) : (
              <><Mic size={17} /> Tap to speak</>
            )}
          </button>
          <small className="live-voice-note">Tap once to start recording. Tap again to stop and receive a spoken reply.</small>
        </section>
      )}

      <button
        type="button"
        onClick={handleOrbClick}
        className={`live-voice-orb live-voice-orb-${voice.status}`}
        aria-label={voice.isRecording ? 'Stop recording and send voice message' : 'Speak to VITAL'}
        title={voice.isRecording ? 'Stop and send' : 'Speak to VITAL'}
      >
        <span className="live-voice-orb-ring" />
        <span className="live-voice-orb-ring live-voice-orb-ring-two" />
        <span className="live-voice-orb-core">
          {voice.status === 'requesting' || voice.status === 'thinking' ? (
            <LoaderCircle size={23} className="animate-spin" />
          ) : voice.isRecording ? (
            <MicOff size={23} />
          ) : (
            <Mic size={23} />
          )}
        </span>
      </button>
    </div>
  )
}
