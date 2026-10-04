import { useEffect, useRef, useState } from 'react'

type VoiceStatus = 'idle' | 'requesting' | 'recording' | 'thinking' | 'speaking' | 'error'

type VoiceContext = {
  pageContext: 'landing' | 'inspection' | 'analysis' | 'camera'
  problem?: string
  category?: string
  diagnosis?: unknown
}

type UseVitalVoiceOptions = VoiceContext & {
  onTranscript?: (transcript: string) => void
  onStartInspection?: () => void
}

type VoiceTurnResponse = {
  transcript?: string
  answer?: string
  error?: string
}

type BrowserSpeechRecognition = {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: {
    results: {
      length: number
      [index: number]: {
        isFinal: boolean
        0: { transcript: string }
      }
    }
  }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
}

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition

const MAX_RECORDING_MS = 12_000

function supportedRecorderMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ]

  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const value = String(reader.result || '')
      resolve(value.includes(',') ? value.split(',')[1] : value)
    }
    reader.onerror = () => reject(new Error('VITAL could not read the microphone recording.'))
    reader.readAsDataURL(blob)
  })
}

function localGreeting(transcript: string): string | null {
  const normalised = transcript.toLowerCase().replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim()
  if (/^(hi|hello|hey)( vital)?$/.test(normalised) || normalised === 'hi vital') {
    return 'Hi! I am VITAL. Show me the equipment or tell me what problem you are noticing.'
  }
  return null
}

function pickEnglishVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis?.getVoices?.() || []
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('en') && /samantha|google|ava|serena/i.test(voice.name))
    || voices.find((voice) => voice.lang.toLowerCase().startsWith('en'))
}

export function useVitalVoice({
  pageContext,
  problem = '',
  category = '',
  diagnosis,
  onTranscript,
  onStartInspection,
}: UseVitalVoiceOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const browserTranscriptRef = useRef('')
  const autoStopTimerRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const discardRecordingRef = useRef(false)

  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [transcript, setTranscript] = useState('')
  const [answer, setAnswer] = useState('')
  const [error, setError] = useState('')

  const clearAutoStop = () => {
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track: MediaStreamTrack) => track.stop())
    streamRef.current = null
  }

  const stopRecognition = () => {
    const recognition = recognitionRef.current
    recognitionRef.current = null
    if (!recognition) return
    try {
      recognition.stop()
    } catch {
      try {
        recognition.abort()
      } catch {
        // Already stopped.
      }
    }
  }

  const speak = (text: string) => {
    if (!window.speechSynthesis || !text.trim()) {
      setStatus('idle')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    const voice = pickEnglishVoice()
    if (voice) utterance.voice = voice

    utterance.onstart = () => mountedRef.current && setStatus('speaking')
    utterance.onend = () => mountedRef.current && setStatus('idle')
    utterance.onerror = () => mountedRef.current && setStatus('idle')
    window.speechSynthesis.speak(utterance)
  }

  const finishWithAnswer = (heard: string, reply: string) => {
    const cleanTranscript = heard.trim()
    const cleanAnswer = reply.trim()

    if (cleanTranscript) {
      setTranscript(cleanTranscript)
      onTranscript?.(cleanTranscript)
      if (/\b(start|begin|open)\s+(an?\s+)?inspection\b/i.test(cleanTranscript)) {
        onStartInspection?.()
      }
    }

    setAnswer(cleanAnswer)
    setError('')
    speak(cleanAnswer)
  }

  const sendRecording = async (blob: Blob) => {
    const browserTranscript = browserTranscriptRef.current.trim()
    const greeting = localGreeting(browserTranscript)
    if (greeting) {
      finishWithAnswer(browserTranscript, greeting)
      return
    }

    setStatus('thinking')
    try {
      const data = await blobToBase64(blob)
      const response = await fetch('/api/voice-turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audio: {
            data,
            mimeType: blob.type || 'audio/webm',
          },
          browserTranscript,
          pageContext,
          problem,
          category,
          diagnosis,
        }),
      })

      const payload = (await response.json()) as VoiceTurnResponse
      if (!response.ok || !payload.answer) {
        throw new Error(payload.error || 'VITAL could not understand that recording.')
      }

      finishWithAnswer(payload.transcript || browserTranscript || 'Voice message', payload.answer)
    } catch (voiceError) {
      const fallbackGreeting = localGreeting(browserTranscript)
      if (fallbackGreeting) {
        finishWithAnswer(browserTranscript, fallbackGreeting)
        return
      }

      setStatus('error')
      setError(voiceError instanceof Error ? voiceError.message : 'VITAL could not process the microphone recording.')
    }
  }

  const stopRecording = () => {
    clearAutoStop()
    stopRecognition()
    const recorder = recorderRef.current

    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
      return
    }

    stopTracks()
    setStatus('idle')
  }

  const startBrowserTranscript = () => {
    const speechWindow = window as typeof window & {
      SpeechRecognition?: SpeechRecognitionConstructor
      webkitSpeechRecognition?: SpeechRecognitionConstructor
    }
    const Constructor = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Constructor) return

    try {
      const recognition = new Constructor()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event) => {
        let value = ''
        for (let index = 0; index < event.results.length; index += 1) {
          value += `${event.results[index][0]?.transcript || ''} `
        }
        browserTranscriptRef.current = value.trim()
        if (value.trim()) setTranscript(value.trim())
      }
      recognition.onerror = () => undefined
      recognition.onend = () => undefined
      recognitionRef.current = recognition
      recognition.start()
    } catch {
      recognitionRef.current = null
    }
  }

  const startRecording = async () => {
    setError('')
    setAnswer('')
    setTranscript('')
    browserTranscriptRef.current = ''
    discardRecordingRef.current = false

    if (!window.isSecureContext) {
      setStatus('error')
      setError('Microphone access requires localhost or an HTTPS website. Run VITAL with npm run dev.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setStatus('error')
      setError('This browser cannot record voice. Use the latest Chrome or Edge.')
      return
    }

    setStatus('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      })
      streamRef.current = stream
      chunksRef.current = []

      const mimeType = supportedRecorderMimeType()
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      recorderRef.current = recorder

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onerror = () => {
        clearAutoStop()
        stopTracks()
        if (mountedRef.current) {
          setStatus('error')
          setError('The browser stopped the microphone recording. Please tap the microphone and try again.')
        }
      }

      recorder.onstop = () => {
        clearAutoStop()
        stopTracks()
        if (discardRecordingRef.current) {
          recorderRef.current = null
          chunksRef.current = []
          return
        }
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' })
        recorderRef.current = null
        chunksRef.current = []

        if (blob.size < 800) {
          setStatus('error')
          setError('I did not hear enough audio. Tap the microphone, speak clearly, then tap it again.')
          return
        }

        void sendRecording(blob)
      }

      startBrowserTranscript()
      recorder.start(250)
      setStatus('recording')
      autoStopTimerRef.current = window.setTimeout(stopRecording, MAX_RECORDING_MS)
    } catch (microphoneError) {
      stopTracks()
      const name = microphoneError instanceof DOMException ? microphoneError.name : ''
      setStatus('error')
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setError('Microphone permission is blocked. Allow it in the browser address-bar settings, then tap again.')
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setError('No microphone was found on this device.')
      } else {
        setError('VITAL could not open the microphone. Use Chrome on localhost or HTTPS and try again.')
      }
    }
  }

  const toggleRecording = () => {
    if (status === 'recording') {
      stopRecording()
      return
    }
    if (status === 'requesting' || status === 'thinking' || status === 'speaking') return
    void startRecording()
  }

  const cancelVoice = () => {
    discardRecordingRef.current = true
    clearAutoStop()
    stopRecognition()
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop()
      } catch {
        // Already stopped.
      }
    }
    recorderRef.current = null
    stopTracks()
    window.speechSynthesis?.cancel()
    setStatus('idle')
  }

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      discardRecordingRef.current = true
      clearAutoStop()
      stopRecognition()
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        try {
          recorderRef.current.stop()
        } catch {
          // Already stopped.
        }
      }
      stopTracks()
      window.speechSynthesis?.cancel()
    }
    // Cleanup is intentionally registered only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return {
    status,
    transcript,
    answer,
    error,
    isBusy: status === 'requesting' || status === 'thinking' || status === 'speaking',
    isRecording: status === 'recording',
    toggleRecording,
    cancelVoice,
    speak,
  }
}
