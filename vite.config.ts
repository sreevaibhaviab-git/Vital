import type { IncomingMessage, ServerResponse } from 'node:http'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { analyseInspection, chatWithVital, createLiveToken, voiceTurn } from './server/vital-ai'

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let rawBody = ''

    request.on('data', (chunk: Buffer) => {
      rawBody += chunk.toString('utf8')
      if (rawBody.length > 5_000_000) {
        reject(new Error('Request is too large. Please use a smaller image.'))
        request.destroy()
      }
    })

    request.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {})
      } catch {
        reject(new Error('Invalid request body.'))
      }
    })

    request.on('error', reject)
  })
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  response.statusCode = statusCode
  response.setHeader('Content-Type', 'application/json')
  response.setHeader('Cache-Control', 'no-store')
  response.end(JSON.stringify(payload))
}

function localVitalApi(): Plugin {
  return {
    name: 'vital-local-ai-api',
    configureServer(server) {
      server.middlewares.use('/api/analyse', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' })
          return
        }

        try {
          const body = await readJsonBody(request)
          const result = await analyseInspection(body as Parameters<typeof analyseInspection>[0])
          sendJson(response, 200, result)
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : 'VITAL could not analyse this image.',
          })
        }
      })

      server.middlewares.use('/api/live-token', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' })
          return
        }

        try {
          const result = await createLiveToken()
          sendJson(response, 200, result)
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : 'VITAL could not start Gemini Live.',
          })
        }
      })

      server.middlewares.use('/api/voice-turn', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' })
          return
        }

        try {
          const body = await readJsonBody(request)
          const result = await voiceTurn(body as Parameters<typeof voiceTurn>[0])
          sendJson(response, 200, result)
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : 'VITAL could not understand the voice recording.',
          })
        }
      })

      server.middlewares.use('/api/chat', async (request, response) => {
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Method not allowed.' })
          return
        }

        try {
          const body = await readJsonBody(request)
          const result = await chatWithVital(body as Parameters<typeof chatWithVital>[0])
          sendJson(response, 200, result)
        } catch (error) {
          sendJson(response, 500, {
            error: error instanceof Error ? error.message : 'VITAL could not answer that question.',
          })
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '')
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || environment.GEMINI_API_KEY
  process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || environment.GEMINI_MODEL

  return {
    plugins: [react(), localVitalApi()],
  }
})
