export type SafetyLevel = 'LOW' | 'CAUTION' | 'STOP'

export type PossibleCause = {
  cause: string
  likelihood: 'Likely' | 'Possible' | 'Uncertain'
}

export type VitalDiagnosis = {
  equipment: string
  summary: string
  safetyLevel: SafetyLevel
  confidence: number
  visibleObservations: string[]
  possibleCauses: PossibleCause[]
  safeChecks: string[]
  stopConditions: string[]
  professionalHelpRequired: boolean
  professionalHelpReason: string
  disclaimer: string
}

export type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
}
