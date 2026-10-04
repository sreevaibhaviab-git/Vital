import { Camera, RefreshCw, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import CameraVoiceAssistant from './CameraVoiceAssistant'

type CameraCaptureProps = {
  onCapture: (file: File) => void
  onClose: () => void
  problem?: string
  category?: string
  onVoiceTranscript?: (transcript: string) => void
}

type FacingMode = 'environment' | 'user'

export default function CameraCapture({
  onCapture,
  onClose,
  problem = '',
  category = '',
  onVoiceTranscript,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [facingMode, setFacingMode] = useState<FacingMode>('environment')
  const [cameraError, setCameraError] = useState('')
  const [isStarting, setIsStarting] = useState(true)

  useEffect(() => {
    let cancelled = false

    const stopStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }

    const startCamera = async () => {
      stopStream()
      setCameraError('')
      setIsStarting(true)

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Live camera is not supported in this browser. Try Chrome, Edge or Safari.')
        setIsStarting(false)
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play()
        }
      } catch (error) {
        const message = error instanceof DOMException ? error.name : ''
        if (message === 'NotAllowedError' || message === 'PermissionDeniedError') {
          setCameraError('Camera permission was blocked. Allow camera access in the browser and try again.')
        } else if (message === 'NotFoundError' || message === 'DevicesNotFoundError') {
          setCameraError('No camera was found on this device.')
        } else {
          setCameraError('VITAL could not open the camera. Camera access needs localhost or an HTTPS website.')
        }
      } finally {
        if (!cancelled) setIsStarting(false)
      }
    }

    void startCamera()

    return () => {
      cancelled = true
      stopStream()
    }
  }, [facingMode])

  const capturePhoto = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('The camera is still starting. Please wait a moment and try again.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Your browser could not capture the photo.')
      return
    }

    if (facingMode === 'user') {
      context.translate(canvas.width, 0)
      context.scale(-1, 1)
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError('VITAL could not save the captured photo.')
          return
        }

        const file = new File([blob], `vital-camera-${Date.now()}.jpg`, {
          type: 'image/jpeg',
          lastModified: Date.now(),
        })
        onCapture(file)
      },
      'image/jpeg',
      0.9,
    )
  }

  return (
    <div className="camera-modal" role="dialog" aria-modal="true" aria-label="VITAL live camera">
      <div className="camera-backdrop" onClick={onClose} />
      <div className="camera-card">
        <div className="camera-header">
          <div>
            <span className="camera-kicker"><Camera size={14} /> Live equipment camera</span>
            <h2>Position the equipment inside the frame.</h2>
          </div>
          <button onClick={onClose} className="camera-close" aria-label="Close camera">
            <X size={20} />
          </button>
        </div>

        <div className="camera-viewfinder">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={facingMode === 'user' ? 'camera-video camera-video-mirrored' : 'camera-video'}
          />
          <div className="camera-scan-line" />
          <span className="camera-corner camera-corner-one" />
          <span className="camera-corner camera-corner-two" />
          <span className="camera-corner camera-corner-three" />
          <span className="camera-corner camera-corner-four" />

          {isStarting && (
            <div className="camera-message">
              <div className="camera-loader" />
              <strong>Starting camera…</strong>
            </div>
          )}

          {cameraError && (
            <div className="camera-message camera-message-error">
              <strong>Camera unavailable</strong>
              <p>{cameraError}</p>
            </div>
          )}

          <CameraVoiceAssistant
            problem={problem}
            category={category}
            onTranscript={onVoiceTranscript}
          />
        </div>

        <div className="camera-controls">
          <button
            onClick={() => setFacingMode((current) => (current === 'environment' ? 'user' : 'environment'))}
            className="camera-secondary-button"
            disabled={isStarting}
          >
            <RefreshCw size={18} /> Switch camera
          </button>

          <button
            onClick={capturePhoto}
            className="camera-shutter"
            disabled={isStarting || Boolean(cameraError)}
            aria-label="Capture equipment photo"
          >
            <span><Camera size={25} /></span>
          </button>

          <button onClick={onClose} className="camera-secondary-button">
            Cancel
          </button>
        </div>

        <p className="camera-help">Keep the full equipment and any visible warning light, damage or blockage inside the frame.</p>
      </div>
    </div>
  )
}
