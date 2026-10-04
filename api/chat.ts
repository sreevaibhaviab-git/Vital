import { chatWithVital, type ChatRequest } from '../server/vital-ai'

type ApiRequest = {
  method?: string
  body?: ChatRequest | string
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
    const body = typeof request.body === 'string' ? JSON.parse(request.body) as ChatRequest : request.body || {}
    const result = await chatWithVital(body)
    response.status(200).json(result)
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'VITAL could not answer that question.',
    })
  }
}
