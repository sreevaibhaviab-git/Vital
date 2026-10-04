import { LoaderCircle, Mic, MicOff, Volume2 } from 'lucide-react'
import { useVitalVoice } from '../hooks/useVitalVoice'

type CameraVoiceAssistantProps = {
  problem?: string
  category?: string
  onTranscript?: (transcript: string) => void
}

export default function CameraVoiceAssistant({
  problem = '',
  category = '',
  onTranscript,
}: CameraVoiceAssistantProps) {
  const voice = useVitalVoice({
    pageContext: 'camera',
    problem,
    category,
    onTranscript,
  })

  return (
    <div className={`camera-voice camera-voice-${voice.status}`} aria-live="polite">
      <button
        type="button"
        className="camera-voice-button"
        onClick={voice.toggleRecording}
        disabled={voice.isBusy}
        aria-label={voice.isRecording ? 'Stop recording and send' : 'Speak to VITAL'}
        title={voice.isRecording ? 'Stop and send' : 'Speak to VITAL'}
      >
        <span className="camera-voice-pulse" />
        <span className="camera-voice-icon">
          {voice.status === 'requesting' || voice.status === 'thinking' ? (
            <LoaderCircle size={22} className="animate-spin" />
          ) : voice.isRecording ? (
            <MicOff size={22} />
          ) : voice.status === 'speaking' ? (
            <Volume2 size={22} />
          ) : (
            <Mic size={22} />
          )}
        </span>
      </button>

      <div className="camera-voice-copy">
        <strong>
          {voice.status === 'requesting' && 'Opening microphone…'}
          {voice.status === 'recording' && 'Listening — tap again to send'}
          {voice.status === 'thinking' && 'VITAL is understanding…'}
          {voice.status === 'speaking' && 'VITAL is replying…'}
          {voice.status === 'error' && 'Microphone needs attention'}
          {voice.status === 'idle' && 'Speak to VITAL'}
        </strong>
        <span>
          {voice.error
            || voice.answer
            || voice.transcript
            || 'Tap the microphone, say “Hi VITAL” or describe the problem, then tap again.'}
        </span>
      </div>
    </div>
  )
}
