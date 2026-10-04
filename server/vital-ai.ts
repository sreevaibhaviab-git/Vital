export type AnalyseRequest = {
  image?: {
    data?: string
    mimeType?: string
  }
  problem?: string
  category?: string
}


export type VoiceTurnRequest = {
  audio?: {
    data?: string
    mimeType?: string
  }
  browserTranscript?: string
  problem?: string
  category?: string
  diagnosis?: unknown
  pageContext?: string
}

export type ChatRequest = {
  diagnosis?: unknown
  problem?: string
  category?: string
  question?: string
  history?: Array<{ role?: string; text?: string }>
  pageContext?: string
}

type GeminiTextResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>
    }
  }>
  error?: {
    message?: string
  }
}

function configuredModel(): string {
  const value = String(process.env.GEMINI_MODEL || '').trim().replace(/^models\//, '')
  return value || 'gemini-2.5-flash'
}

function geminiEndpoint(model: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
}

const diagnosisSchema = {
  type: 'OBJECT',
  properties: {
    equipment: { type: 'STRING' },
    summary: { type: 'STRING' },
    safetyLevel: { type: 'STRING', enum: ['LOW', 'CAUTION', 'STOP'] },
    confidence: { type: 'INTEGER', minimum: 0, maximum: 100 },
    visibleObservations: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 1,
      maxItems: 6,
    },
    possibleCauses: {
      type: 'ARRAY',
      minItems: 1,
      maxItems: 5,
      items: {
        type: 'OBJECT',
        properties: {
          cause: { type: 'STRING' },
          likelihood: { type: 'STRING', enum: ['Likely', 'Possible', 'Uncertain'] },
        },
        required: ['cause', 'likelihood'],
      },
    },
    safeChecks: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 1,
      maxItems: 6,
    },
    stopConditions: {
      type: 'ARRAY',
      items: { type: 'STRING' },
      minItems: 1,
      maxItems: 6,
    },
    professionalHelpRequired: { type: 'BOOLEAN' },
    professionalHelpReason: { type: 'STRING' },
    disclaimer: { type: 'STRING' },
  },
  required: [
    'equipment',
    'summary',
    'safetyLevel',
    'confidence',
    'visibleObservations',
    'possibleCauses',
    'safeChecks',
    'stopConditions',
    'professionalHelpRequired',
    'professionalHelpReason',
    'disclaimer',
  ],
}

function requireApiKey(): string {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error('Gemini is not connected yet. Copy .env.example to .env and add your free GEMINI_API_KEY.')
  }
  return apiKey
}

function extractText(payload: GeminiTextResponse): string {
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new Error(payload.error?.message || 'Gemini returned an empty response. Please try another clear photo.')
  }

  return text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
}


function normaliseDiagnosis(value: Record<string, unknown>) {
  const stringArray = (item: unknown, fallback: string[]) => {
    const filtered = Array.isArray(item)
      ? item.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0).slice(0, 6)
      : []
    return filtered.length ? filtered : fallback
  }

  const rawCauses = Array.isArray(value.possibleCauses) ? value.possibleCauses : []
  const possibleCauses = rawCauses
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const cause = typeof (item as Record<string, unknown>).cause === 'string'
        ? String((item as Record<string, unknown>).cause)
        : ''
      const rawLikelihood = (item as Record<string, unknown>).likelihood
      const likelihood = rawLikelihood === 'Likely' || rawLikelihood === 'Possible' || rawLikelihood === 'Uncertain'
        ? rawLikelihood
        : 'Uncertain'
      return cause ? { cause, likelihood } : null
    })
    .filter(Boolean)
    .slice(0, 5)

  const rawLevel = value.safetyLevel
  const safetyLevel = rawLevel === 'LOW' || rawLevel === 'CAUTION' || rawLevel === 'STOP' ? rawLevel : 'CAUTION'
  const rawConfidence = typeof value.confidence === 'number' ? value.confidence : 50

  return {
    equipment: typeof value.equipment === 'string' ? value.equipment : 'Equipment not confidently identified',
    summary: typeof value.summary === 'string' ? value.summary : 'VITAL could not form a complete visual summary.',
    safetyLevel,
    confidence: Math.max(0, Math.min(100, Math.round(rawConfidence))),
    visibleObservations: stringArray(value.visibleObservations, ['No reliable visible observation was returned.']),
    possibleCauses: possibleCauses.length
      ? possibleCauses
      : [{ cause: 'The cause cannot be confirmed from this photo alone.', likelihood: 'Uncertain' as const }],
    safeChecks: stringArray(value.safeChecks, ['Keep the equipment powered off and contact a qualified professional if the problem continues.']),
    stopConditions: stringArray(value.stopConditions, ['Stop if you notice smoke, burning smell, heat, sparks, leaking fluid or exposed wiring.']),
    professionalHelpRequired: safetyLevel === 'STOP' || Boolean(value.professionalHelpRequired),
    professionalHelpReason: typeof value.professionalHelpReason === 'string'
      ? value.professionalHelpReason
      : 'Professional help may be needed if the issue continues or safety changes.',
    disclaimer: typeof value.disclaimer === 'string'
      ? value.disclaimer
      : 'This is an AI visual inspection, not a certified diagnosis.',
  }
}

async function callGemini(body: unknown, preferredModel?: string): Promise<GeminiTextResponse> {
  const apiKey = requireApiKey()
  const models = [...new Set([preferredModel, configuredModel(), 'gemini-2.5-flash'].filter(Boolean) as string[])]
  let lastMessage = 'Gemini could not complete the request.'

  for (const model of models) {
    const response = await fetch(geminiEndpoint(model), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    })

    const payload = (await response.json()) as GeminiTextResponse
    if (response.ok) return payload

    lastMessage = payload.error?.message || `Gemini request failed with status ${response.status}.`
    const modelProblem = response.status === 404
      || /models?\/.*not found|not supported|unknown model|model.*does not exist/i.test(lastMessage)

    if (!modelProblem) throw new Error(lastMessage)
  }

  throw new Error(lastMessage)
}


export async function createLiveToken() {
  const apiKey = requireApiKey()
  const now = Date.now()
  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/auth_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now + 30 * 60 * 1000).toISOString(),
      newSessionExpireTime: new Date(now + 60 * 1000).toISOString(),
    }),
  })

  const payload = (await response.json()) as { name?: string; error?: { message?: string } }
  if (!response.ok || !payload.name) {
    throw new Error(payload.error?.message || 'Gemini could not create a secure Live API token.')
  }

  return {
    token: payload.name,
    model: 'gemini-3.1-flash-live-preview',
  }
}

export async function analyseInspection(input: AnalyseRequest) {
  const imageData = input.image?.data?.trim()
  const mimeType = input.image?.mimeType?.trim() || 'image/jpeg'
  const problem = input.problem?.trim()
  const category = input.category?.trim() || 'Not selected'

  if (!imageData) throw new Error('The equipment image is missing.')
  if (!problem) throw new Error('The equipment problem is missing.')
  if (imageData.length > 3_000_000) throw new Error('The prepared image is too large. Please use another photo.')

  const prompt = `
You are VITAL, a safety-first visual maintenance copilot.
Analyse the attached equipment photo together with the user's description.

USER-SELECTED CATEGORY: ${category}
USER-REPORTED PROBLEM: ${problem}

STRICT RULES:
1. Report only what is reasonably visible or directly supported by the description.
2. Never pretend you can confirm an internal fault from one photo.
3. Separate visible observations from possible causes.
4. Do not provide repair steps involving live mains electricity, exposed wiring, gas, refrigerants, pressure systems, fire-damaged equipment, swollen/leaking batteries, moving machinery, heavy machinery, vehicle brakes, steering or other safety-critical systems.
5. If any high-risk condition is visible or described, set safetyLevel to STOP, recommend stopping use and contacting a qualified professional.
6. Safe checks must be non-invasive, simple, and possible with the equipment powered off and unplugged where relevant.
7. Do not tell the user to remove protective covers, open power supplies, bypass safety systems or touch internal capacitors.
8. Keep every item concise and written for a beginner.
9. Confidence represents confidence in the visible assessment, not certainty of the actual fault.
10. The disclaimer must clearly say this is an AI visual inspection, not a certified diagnosis.

Return only the requested JSON structure.
`.trim()

  const payload = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          {
            inlineData: {
              mimeType,
              data: imageData,
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2200,
      responseMimeType: 'application/json',
      responseSchema: diagnosisSchema,
    },
  })

  const rawDiagnosis = JSON.parse(extractText(payload)) as Record<string, unknown>
  return { diagnosis: normaliseDiagnosis(rawDiagnosis) }
}


export async function voiceTurn(input: VoiceTurnRequest) {
  const audioData = input.audio?.data?.trim()
  const mimeType = input.audio?.mimeType?.trim() || 'audio/webm'
  const browserTranscript = input.browserTranscript?.trim() || ''

  if (!audioData) throw new Error('The microphone recording is empty.')
  if (audioData.length > 4_500_000) throw new Error('The voice recording is too large. Keep it under 12 seconds.')

  const contextSummary = [
    `CURRENT PAGE: ${String(input.pageContext || 'camera').slice(0, 80)}`,
    input.category ? `EQUIPMENT CATEGORY: ${String(input.category).slice(0, 120)}` : '',
    input.problem ? `CURRENT PROBLEM: ${String(input.problem).slice(0, 900)}` : '',
    input.diagnosis ? `INSPECTION REPORT: ${JSON.stringify(input.diagnosis).slice(0, 6000)}` : '',
    browserTranscript ? `BROWSER TRANSCRIPT HINT: ${browserTranscript.slice(0, 600)}` : '',
  ].filter(Boolean).join('\n')

  const responseSchema = {
    type: 'OBJECT',
    properties: {
      transcript: { type: 'STRING' },
      answer: { type: 'STRING' },
    },
    required: ['transcript', 'answer'],
  }

  const prompt = `
You are VITAL, a warm, concise, safety-first visual maintenance copilot.
Listen to the attached short voice recording.

1. Transcribe what the user said into clear English. Preserve the meaning and do not invent words.
2. Reply naturally in no more than 55 words.
3. When the user says hi, hello, hey, or greets VITAL, reply with a friendly greeting and say you are ready to inspect equipment.
4. When the user describes a problem, acknowledge it and invite them to keep the equipment in the camera frame and capture a clear photo.
5. Do not claim you can see a fault unless an inspection report is provided.
6. Never give dangerous guidance involving live electricity, exposed wiring, gas, refrigerants, pressure systems, fire damage, swollen batteries, moving machinery, or safety-critical vehicle systems.
7. If danger is mentioned, tell the user to stop using the equipment and contact a qualified professional.

${contextSummary}

Return only JSON with transcript and answer.
`.trim()

  const payload = await callGemini({
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: audioData } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 450,
      responseMimeType: 'application/json',
      responseSchema,
    },
  }, 'gemini-2.5-flash')

  const value = JSON.parse(extractText(payload)) as { transcript?: unknown; answer?: unknown }
  const transcript = typeof value.transcript === 'string' && value.transcript.trim()
    ? value.transcript.trim()
    : browserTranscript || 'Voice message'
  const answer = typeof value.answer === 'string' && value.answer.trim()
    ? value.answer.trim()
    : 'I heard you. Keep the equipment inside the frame and capture a clear photo so I can help safely.'

  return { transcript, answer }
}

export async function chatWithVital(input: ChatRequest) {
  const question = input.question?.trim()
  if (!question) throw new Error('Ask VITAL a question first.')

  const safeHistory = (input.history || [])
    .slice(-6)
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => `${message.role === 'assistant' ? 'VITAL' : 'USER'}: ${String(message.text || '').slice(0, 800)}`)
    .join('\n')

  const hasDiagnosis = Boolean(input.diagnosis && typeof input.diagnosis === 'object')
  const pageContext = String(input.pageContext || (hasDiagnosis ? 'analysis' : 'landing')).slice(0, 80)

  const prompt = hasDiagnosis
    ? `
You are VITAL, a calm, conversational, safety-first visual maintenance copilot.
Answer the user's follow-up question using only the inspection report and reported problem below.
Do not invent new visible facts. Clearly state uncertainty. Keep the answer under 140 words.
Never provide instructions involving live electricity, exposed wiring, gas, refrigerants, pressure systems, fire damage, swollen/leaking batteries, moving machinery, heavy machinery or safety-critical vehicle systems.
When the requested action could be dangerous, tell the user to stop and contact a qualified professional.
Use simple spoken language because the answer will usually be read aloud.
Respond naturally to greetings and short conversational questions.

CATEGORY: ${String(input.category || 'Not selected').slice(0, 120)}
REPORTED PROBLEM: ${String(input.problem || '').slice(0, 800)}
INSPECTION REPORT: ${JSON.stringify(input.diagnosis || {}).slice(0, 7000)}
RECENT CONVERSATION:
${safeHistory || 'No earlier follow-up messages.'}

USER QUESTION: ${question.slice(0, 1000)}
`.trim()
    : `
You are VITAL, a warm, concise, voice-first visual maintenance copilot speaking to a beginner.
The user has not completed a visual inspection yet. You may:
- greet the user naturally;
- explain what VITAL does;
- help the user describe an equipment problem;
- ask them to upload or capture a clear equipment photo;
- guide them to start an inspection;
- provide only broad, non-invasive safety reminders.

Do not claim that you can see equipment when no inspection image has been analysed.
Do not diagnose an internal fault without an image and structured inspection.
Never provide instructions involving live electricity, exposed wiring, gas, refrigerants, pressure systems, fire damage, swollen or leaking batteries, moving machinery, heavy machinery, or safety-critical vehicle systems.
When danger is mentioned, tell the user to stop using the equipment and contact a qualified professional.
Keep the answer conversational and under 90 words because it will be spoken aloud.
If the user says hello, reply with a friendly hello and briefly invite them to describe the problem or start an inspection.

CURRENT PAGE: ${pageContext}
CURRENT CATEGORY: ${String(input.category || 'Not selected').slice(0, 120)}
CURRENT PROBLEM DRAFT: ${String(input.problem || '').slice(0, 800)}
RECENT CONVERSATION:
${safeHistory || 'No earlier messages.'}

USER SAID: ${question.slice(0, 1000)}
`.trim()

  const payload = await callGemini({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.25,
      maxOutputTokens: hasDiagnosis ? 500 : 320,
    },
  })

  return { answer: extractText(payload) }
}
