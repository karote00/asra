import { Buffer } from 'node:buffer'
import { URL } from 'node:url'

const DOCUMENT_ENDPOINT_PREFIX = '/api/documents/'
const MAX_DOCUMENT_BYTES = 64 * 1024 * 1024

const sendJson = (response, statusCode, payload) => {
  const body = JSON.stringify(payload)
  response.statusCode = statusCode
  response.setHeader('cache-control', 'no-store')
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(body)
}

const readJsonBody = async (request) => {
  const chunks = []
  let byteLength = 0

  for await (const chunk of request) {
    byteLength += chunk.byteLength
    if (byteLength > MAX_DOCUMENT_BYTES) {
      throw new Error('Document database request exceeds the E2E byte limit')
    }
    chunks.push(chunk)
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Test-only implementation of the App's formal same-origin document database
 * contract. It is enabled only by Playwright server commands and is never a
 * production or ordinary development persistence fallback.
 */
export const createDocumentDatabaseMiddleware = () => {
  const documents = new Map()

  return async (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://e2e.local')
    if (!url.pathname.startsWith(DOCUMENT_ENDPOINT_PREFIX)) {
      next()
      return
    }

    const encodedFileId = url.pathname.slice(DOCUMENT_ENDPOINT_PREFIX.length)
    if (!encodedFileId) {
      sendJson(response, 404, { error: 'Document fileId is required' })
      return
    }

    let fileId
    try {
      fileId = decodeURIComponent(encodedFileId)
    } catch {
      sendJson(response, 400, { error: 'Document fileId is invalid' })
      return
    }

    try {
      if (request.method === 'GET') {
        sendJson(response, 200, {
          document: documents.has(fileId) ? documents.get(fileId) : null
        })
        return
      }

      if (request.method === 'PUT') {
        const payload = await readJsonBody(request)
        if (
          typeof payload !== 'object' ||
          payload === null ||
          !Object.hasOwn(payload, 'document')
        ) {
          sendJson(response, 400, { error: 'Document payload is invalid' })
          return
        }
        documents.set(fileId, payload.document)
        sendJson(response, 200, { ok: true })
        return
      }

      if (request.method === 'DELETE') {
        documents.delete(fileId)
        sendJson(response, 200, { ok: true })
        return
      }

      response.setHeader('allow', 'DELETE, GET, PUT')
      sendJson(response, 405, { error: 'Document method is unsupported' })
    } catch (error) {
      sendJson(response, 400, {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }
}
