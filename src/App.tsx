import { ChangeEvent, DragEvent, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Bike,
  Camera,
  Check,
  Fan,
  Globe,
  Image as ImageIcon,
  Instagram,
  Laptop,
  LoaderCircle,
  Printer,
  Router,
  ShieldCheck,
  Sparkles,
  Twitter,
  UploadCloud,
  Wrench,
  X,
} from 'lucide-react'
import AnalysisResult from './components/AnalysisResult'
import CameraCapture from './components/CameraCapture'
import LiveVoiceAssistant from './components/LiveVoiceAssistant'
import type { VitalDiagnosis } from './types'
import { optimiseImageForAi } from './utils/image'

const VIDEO_SRC =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260328_115001_bcdaa3b4-03de-47e7-ad63-ae3e392c32d4.mp4'

const FADE_DURATION = 500
const FADE_OUT_LEAD = 0.55
const RESTART_DELAY = 100

type AppPage = 'home' | 'inspect'
type InspectionStep = 'details' | 'review' | 'analysis'

type Category = {
  id: string
  label: string
  icon: typeof Laptop
}

const categories: Category[] = [
  { id: 'computer', label: 'Computer', icon: Laptop },
  { id: 'printer', label: 'Printer', icon: Printer },
  { id: 'router', label: 'Router', icon: Router },
  { id: 'fan', label: 'Fan', icon: Fan },
  { id: 'bicycle', label: 'Bicycle', icon: Bike },
  { id: 'other', label: 'Other', icon: Wrench },
]

function pageFromHash(): AppPage {
  return window.location.hash === '#inspect' ? 'inspect' : 'home'
}

export default function App() {
  const [page, setPage] = useState<AppPage>(pageFromHash)
  const [initialProblem, setInitialProblem] = useState('')

  useEffect(() => {
    const handleHashChange = () => setPage(pageFromHash())
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const openInspection = (problem = '') => {
    setInitialProblem(problem)
    window.location.hash = 'inspect'
    setPage('inspect')
  }

  const openHome = () => {
    window.location.hash = ''
    setPage('home')
  }

  if (page === 'inspect') {
    return <InspectionPage initialProblem={initialProblem} onBack={openHome} />
  }

  return <LandingPage onStartInspection={openInspection} />
}

type LandingPageProps = {
  onStartInspection: (problem?: string) => void
}

function LandingPage({ onStartInspection }: LandingPageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const frameRef = useRef<number | null>(null)
  const timeoutRef = useRef<number | null>(null)
  const fadingOutRef = useRef(false)
  const [problem, setProblem] = useState('')

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    video.style.opacity = '0'

    const cancelFade = () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }

    const fadeTo = (target: number) => {
      cancelFade()
      const from = Number.parseFloat(video.style.opacity || '0')
      const delta = target - from
      if (delta === 0) return

      const start = performance.now()
      const step = (now: number) => {
        const progress = Math.min((now - start) / FADE_DURATION, 1)
        video.style.opacity = String(from + delta * progress)
        if (progress < 1) frameRef.current = requestAnimationFrame(step)
        else frameRef.current = null
      }
      frameRef.current = requestAnimationFrame(step)
    }

    const startPlayback = () => {
      const attempt = video.play()
      if (attempt) attempt.catch(() => undefined)
    }

    const handleCanPlay = () => {
      if (fadingOutRef.current) return
      startPlayback()
      fadeTo(1)
    }

    const handleTimeUpdate = () => {
      const { duration, currentTime } = video
      if (!Number.isFinite(duration) || duration === 0) return
      if (duration - currentTime <= FADE_OUT_LEAD && !fadingOutRef.current) {
        fadingOutRef.current = true
        fadeTo(0)
      }
    }

    const handleEnded = () => {
      cancelFade()
      video.style.opacity = '0'
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        video.currentTime = 0
        startPlayback()
        fadingOutRef.current = false
        fadeTo(1)
      }, RESTART_DELAY)
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('timeupdate', handleTimeUpdate)
    video.addEventListener('ended', handleEnded)
    if (video.readyState >= 3) handleCanPlay()

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('timeupdate', handleTimeUpdate)
      video.removeEventListener('ended', handleEnded)
      cancelFade()
      if (timeoutRef.current !== null) clearTimeout(timeoutRef.current)
    }
  }, [])

  const handleStartInspection = () => onStartInspection(problem.trim())

  return (
    <div className="relative min-h-screen bg-black overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover translate-y-[17%]"
        src={VIDEO_SRC}
        autoPlay
        muted
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />

      <div className="relative flex flex-col min-h-screen">
        <nav className="relative z-20 pl-6 pr-6 py-6">
          <div className="rounded-full px-6 py-3 flex items-center justify-between max-w-5xl mx-auto">
            <div className="flex items-center gap-8">
              <a href="#" className="flex items-center gap-2 text-white">
                <Globe size={24} />
                <span className="font-semibold text-lg">VITAL</span>
              </a>
              <div className="hidden md:flex items-center gap-8">
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm font-medium">Features</a>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm font-medium">Safety</a>
                <a href="#" className="text-white/80 hover:text-white transition-colors text-sm font-medium">About</a>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button className="text-white text-sm font-medium">History</button>
              <button onClick={() => onStartInspection('')} className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium">
                Inspect
              </button>
            </div>
          </div>
        </nav>

        <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[20%]">
          <h1
            className="text-5xl md:text-6xl lg:text-7xl text-white mb-8 tracking-tight whitespace-nowrap"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            See what equipment cannot say
          </h1>

          <div className="max-w-xl w-full space-y-4">
            <div className="liquid-glass rounded-full pl-6 pr-2 py-2 flex items-center gap-3">
              <input
                type="text"
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') handleStartInspection()
                }}
                placeholder="Describe your equipment problem"
                aria-label="Equipment problem"
                className="flex-1 bg-transparent border-none outline-none text-white placeholder:text-white/40 text-base"
              />
              <button onClick={handleStartInspection} aria-label="Start inspection" className="bg-white rounded-full p-3 text-black shrink-0">
                <ArrowRight size={20} />
              </button>
            </div>

            <p className="text-white text-sm leading-relaxed px-4">
              <span className="block mb-1">Visual Inspection • Troubleshooting • Analysis • Logging</span>
              VITAL is an AI-powered visual maintenance copilot that identifies equipment problems,
              guides safe inspections and creates structured maintenance reports.
            </p>

            <div className="flex justify-center">
              <button
                onClick={() => onStartInspection('')}
                className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium hover:bg-white/5 transition-colors"
              >
                Start inspection
              </button>
            </div>
          </div>
        </main>

        <footer className="relative z-10 flex justify-center gap-4 pb-12">
          <a href="#" aria-label="Instagram" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
            <Instagram size={20} />
          </a>
          <a href="#" aria-label="Twitter" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
            <Twitter size={20} />
          </a>
          <a href="#" aria-label="Website" className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
            <Globe size={20} />
          </a>
        </footer>
      </div>

      <LiveVoiceAssistant
        pageContext="landing"
        problem={problem}
        onStartInspection={() => onStartInspection(problem.trim())}
      />
    </div>
  )
}

type InspectionPageProps = {
  initialProblem: string
  onBack: () => void
}

function InspectionPage({ initialProblem, onBack }: InspectionPageProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<InspectionStep>('details')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [category, setCategory] = useState('')
  const [problem, setProblem] = useState(initialProblem)
  const [isDragging, setIsDragging] = useState(false)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [error, setError] = useState('')
  const [analysisError, setAnalysisError] = useState('')
  const [isAnalysing, setIsAnalysing] = useState(false)
  const [diagnosis, setDiagnosis] = useState<VitalDiagnosis | null>(null)

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl('')
      return
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile)
    setPreviewUrl(nextPreviewUrl)
    return () => URL.revokeObjectURL(nextPreviewUrl)
  }, [selectedFile])

  const chooseFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please upload an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Please choose an image smaller than 10 MB.')
      return
    }

    setSelectedFile(file)
    setDiagnosis(null)
    setAnalysisError('')
    setError('')
  }

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    chooseFile(event.target.files?.[0])
    event.target.value = ''
  }

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(false)
    chooseFile(event.dataTransfer.files?.[0])
  }

  const removeImage = () => {
    setSelectedFile(null)
    setPreviewUrl('')
    setDiagnosis(null)
  }

  const continueToReview = () => {
    if (!selectedFile) {
      setError('Add a clear equipment photo before continuing.')
      return
    }
    if (!problem.trim()) {
      setError('Describe what is wrong with the equipment.')
      return
    }

    setError('')
    setStep('review')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const beginAnalysis = async () => {
    if (!selectedFile) return
    setIsAnalysing(true)
    setAnalysisError('')

    try {
      const image = await optimiseImageForAi(selectedFile)
      const response = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          problem: problem.trim(),
          category: selectedCategory?.label ?? 'Not selected',
        }),
      })

      const payload = (await response.json()) as { diagnosis?: VitalDiagnosis; error?: string }
      if (!response.ok || !payload.diagnosis) {
        throw new Error(payload.error || 'VITAL could not analyse this image.')
      }

      setDiagnosis(payload.diagnosis)
      setStep('analysis')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (analysisFailure) {
      setAnalysisError(
        analysisFailure instanceof Error ? analysisFailure.message : 'VITAL could not analyse this image.',
      )
    } finally {
      setIsAnalysing(false)
    }
  }

  const startNewInspection = () => {
    setStep('details')
    setSelectedFile(null)
    setPreviewUrl('')
    setCategory('')
    setProblem('')
    setDiagnosis(null)
    setError('')
    setAnalysisError('')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const selectedCategory = categories.find((item) => item.id === category)

  return (
    <div className="inspection-shell min-h-screen text-white">
      <div className="inspection-orb inspection-orb-one" />
      <div className="inspection-orb inspection-orb-two" />
      <div className="inspection-grid" />

      <header className="relative z-20 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-5 flex items-center justify-between gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-white">
            <Globe size={23} />
            <span className="font-semibold text-lg">VITAL</span>
          </button>

          <div className="hidden sm:flex items-center gap-2 text-xs text-white/45">
            <span className={step === 'details' ? 'step-pill step-pill-active' : 'step-pill'}>01 Details</span>
            <span className="h-px w-8 bg-white/15" />
            <span className={step === 'review' ? 'step-pill step-pill-active' : 'step-pill'}>02 Review</span>
            <span className="h-px w-8 bg-white/15" />
            <span className={step === 'analysis' ? 'step-pill step-pill-active' : 'step-pill'}>03 Analyse</span>
          </div>

          <button onClick={onBack} className="liquid-glass rounded-full px-4 py-2 text-sm text-white/80 hover:text-white">
            Exit
          </button>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-10 md:py-14">
        {step === 'details' && (
          <>
            <div className="max-w-3xl mb-10">
              <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white mb-7 transition-colors">
                <ArrowLeft size={16} /> Back to VITAL
              </button>
              <p className="eyebrow"><Sparkles size={14} /> New visual inspection</p>
              <h1 className="inspection-title">Show VITAL what you can see.</h1>
              <p className="inspection-subtitle">
                Add one clear photo or open the live webcam. VITAL will use the image and your description to prepare a safe visual inspection.
              </p>
            </div>

            <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-6 items-start">
              <section className="inspection-card p-5 md:p-7">
                <div className="section-heading-row">
                  <div>
                    <span className="section-number">01</span>
                    <h2>Equipment photo</h2>
                  </div>
                  <span className="required-label">Required</span>
                </div>

                {previewUrl ? (
                  <div className="photo-preview-wrap">
                    <img src={previewUrl} alt="Selected equipment" className="photo-preview" />
                    <div className="photo-preview-overlay" />
                    <button onClick={removeImage} className="remove-photo" aria-label="Remove selected image">
                      <X size={18} />
                    </button>
                    <div className="photo-ready-chip"><Check size={14} /> Photo ready</div>
                  </div>
                ) : (
                  <div
                    onDragEnter={(event) => {
                      event.preventDefault()
                      setIsDragging(true)
                    }}
                    onDragOver={(event) => event.preventDefault()}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`upload-zone ${isDragging ? 'upload-zone-dragging' : ''}`}
                  >
                    <div className="upload-icon"><UploadCloud size={27} /></div>
                    <h3>Drop an equipment photo here</h3>
                    <p>Use a clear, well-lit JPG, PNG or WEBP image up to 10 MB.</p>
                    <div className="flex flex-col sm:flex-row gap-3 mt-6">
                      <button onClick={() => fileInputRef.current?.click()} className="primary-action">
                        <ImageIcon size={17} /> Choose photo
                      </button>
                      <button onClick={() => setCameraOpen(true)} className="secondary-action">
                        <Camera size={17} /> Open live camera
                      </button>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="photo-tips">
                  <span><Check size={14} /> Show the complete equipment</span>
                  <span><Check size={14} /> Keep damage or warning lights visible</span>
                  <span><Check size={14} /> Avoid sensitive labels and personal data</span>
                </div>
              </section>

              <section className="inspection-card p-5 md:p-7">
                <div className="section-heading-row">
                  <div>
                    <span className="section-number">02</span>
                    <h2>Inspection details</h2>
                  </div>
                </div>

                <label className="field-label">Equipment category <span>Optional</span></label>
                <div className="category-grid">
                  {categories.map((item) => {
                    const Icon = item.icon
                    const active = category === item.id
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCategory(active ? '' : item.id)}
                        className={`category-button ${active ? 'category-button-active' : ''}`}
                      >
                        <Icon size={20} />
                        <span>{item.label}</span>
                        {active && <Check size={14} className="category-check" />}
                      </button>
                    )
                  })}
                </div>

                <label htmlFor="equipment-problem" className="field-label mt-7">
                  What is happening? <span className="required-text">Required</span>
                </label>
                <div className="textarea-wrap">
                  <textarea
                    id="equipment-problem"
                    value={problem}
                    onChange={(event) => setProblem(event.target.value.slice(0, 600))}
                    placeholder="Example: My laptop becomes very hot, the fan is loud and it shuts down after ten minutes."
                    rows={7}
                  />
                  <span className="character-count">{problem.length}/600</span>
                </div>

                {error && <div className="form-error">{error}</div>}

                <button onClick={continueToReview} className="continue-button">
                  Review inspection <ArrowRight size={18} />
                </button>
              </section>
            </div>

            <div className="safety-strip">
              <div className="safety-icon"><ShieldCheck size={22} /></div>
              <div>
                <strong>Safety comes before diagnosis.</strong>
                <p>Do not touch live wiring, leaking batteries, gas systems, moving machinery or fire-damaged equipment.</p>
              </div>
            </div>
          </>
        )}

        {step === 'review' && (
          <ReviewInspection
            imageUrl={previewUrl}
            fileName={selectedFile?.name ?? 'Equipment photo'}
            category={selectedCategory?.label ?? 'Not selected'}
            problem={problem}
            isAnalysing={isAnalysing}
            analysisError={analysisError}
            onEdit={() => setStep('details')}
            onAnalyse={() => void beginAnalysis()}
          />
        )}

        {step === 'analysis' && diagnosis && (
          <AnalysisResult
            diagnosis={diagnosis}
            imageUrl={previewUrl}
            problem={problem}
            category={selectedCategory?.label ?? 'Not selected'}
            onNewInspection={startNewInspection}
            onEdit={() => setStep('details')}
          />
        )}
      </main>

      {cameraOpen && (
        <CameraCapture
          onCapture={(file) => {
            chooseFile(file)
            setCameraOpen(false)
          }}
          onClose={() => setCameraOpen(false)}
          problem={problem}
          category={selectedCategory?.label ?? 'Not selected'}
          onVoiceTranscript={(transcript) => {
            setProblem((current) => {
              const clean = transcript.trim()
              if (!clean) return current
              if (!current.trim()) return clean.slice(0, 600)
              if (current.toLowerCase().includes(clean.toLowerCase())) return current
              return `${current.trim()} ${clean}`.slice(0, 600)
            })
          }}
        />
      )}

      <LiveVoiceAssistant
        pageContext={step === 'analysis' ? 'analysis' : 'inspection'}
        problem={problem}
        category={selectedCategory?.label ?? 'Not selected'}
        diagnosis={diagnosis}
      />
    </div>
  )
}

type ReviewInspectionProps = {
  imageUrl: string
  fileName: string
  category: string
  problem: string
  isAnalysing: boolean
  analysisError: string
  onEdit: () => void
  onAnalyse: () => void
}

function ReviewInspection({
  imageUrl,
  fileName,
  category,
  problem,
  isAnalysing,
  analysisError,
  onEdit,
  onAnalyse,
}: ReviewInspectionProps) {
  return (
    <div className="max-w-5xl mx-auto">
      <button onClick={onEdit} className="inline-flex items-center gap-2 text-sm text-white/55 hover:text-white mb-7 transition-colors">
        <ArrowLeft size={16} /> Edit inspection
      </button>

      <div className="max-w-3xl mb-10">
        <p className="eyebrow"><Check size={14} /> Inspection ready</p>
        <h1 className="inspection-title">Review before analysis.</h1>
        <p className="inspection-subtitle">
          Confirm the photo and problem details. VITAL will send a compressed copy to Gemini for visual analysis and return a structured safety-first report.
        </p>
      </div>

      <div className="inspection-card overflow-hidden">
        <div className="grid md:grid-cols-[0.9fr_1.1fr]">
          <div className="review-image-panel">
            <img src={imageUrl} alt="Equipment review" className="review-image" />
            <div className="review-image-caption">
              <ImageIcon size={16} />
              <span className="truncate">{fileName}</span>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <div className="review-status"><span /> READY FOR VISUAL ANALYSIS</div>

            <dl className="review-list">
              <div>
                <dt>Equipment category</dt>
                <dd>{category}</dd>
              </div>
              <div>
                <dt>Reported problem</dt>
                <dd>{problem}</dd>
              </div>
              <div>
                <dt>Safety protocol</dt>
                <dd>Visual inspection only. High-risk repair instructions are blocked.</dd>
              </div>
            </dl>

            {analysisError && <div className="form-error mt-6">{analysisError}</div>}

            <button onClick={onAnalyse} className="continue-button mt-8" disabled={isAnalysing}>
              {isAnalysing ? (
                <><LoaderCircle size={18} className="spin" /> VITAL is analysing…</>
              ) : (
                <>Begin visual analysis <ArrowRight size={18} /></>
              )}
            </button>

            <p className="api-note">You need a free Gemini API key in the <code>.env</code> file. Your key stays on the local/server side and is never placed in the browser.</p>
          </div>
        </div>
      </div>

      <div className="safety-strip">
        <div className="safety-icon"><ShieldCheck size={22} /></div>
        <div>
          <strong>VITAL provides inspection guidance, not certified repair advice.</strong>
          <p>Stop using equipment immediately when there is smoke, fire, exposed mains wiring, gas or a swollen battery.</p>
        </div>
      </div>
    </div>
  )
}
