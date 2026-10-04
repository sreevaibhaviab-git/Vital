import { createLiveToken } from '../server/vital-ai'

type ApiRequest = {
  method?: string
}

type ApiResponse = {
  status: (statusCode: number) => ApiResponse
  json: (body: unknown) => void
  setHeader: (name: string, value: string) => void
}

export default async function handler(request: ApiRequest, response: ApiResponse) {
  response.setHeader('Cache-Control', 'no-store')

  if (request.method !== 'POST') {
    response.status(405).json({ error: 'Method not allowed.' })
    return
  }

  try {
    const result = await createLiveToken()
    response.status(200).json(result)
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'VITAL could not start Gemini Live.',
    })
  }
}
