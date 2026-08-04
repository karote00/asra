import { Buffer } from 'node:buffer'
import { URL } from 'node:url'

const DOCUMENT_ENDPOINT_PREFIX = '/api/documents/'
const PERSISTENCE_BATCH_SUFFIX = '/persistence-batches'
const BOOTSTRAP_CHECKPOINT_SUFFIX = '/bootstrap-checkpoint'
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
export const createDocumentDatabaseMiddleware = ({
  materializePersistenceBatch,
  readBootstrapCheckpoint
} = {}) => {
  const documents = new Map()

  return async (request, response, next) => {
    const url = new URL(request.url ?? '/', 'http://e2e.local')
    if (!url.pathname.startsWith(DOCUMENT_ENDPOINT_PREFIX)) {
      next()
      return
    }

    const encodedDocumentPath = url.pathname.slice(
      DOCUMENT_ENDPOINT_PREFIX.length
    )
    const isPersistenceBatchRequest = encodedDocumentPath.endsWith(
      PERSISTENCE_BATCH_SUFFIX
    )
    const isBootstrapCheckpointRequest = encodedDocumentPath.endsWith(
      BOOTSTRAP_CHECKPOINT_SUFFIX
    )
    let encodedFileId = encodedDocumentPath
    if (isPersistenceBatchRequest) {
      encodedFileId = encodedDocumentPath.slice(
        0,
        -PERSISTENCE_BATCH_SUFFIX.length
      )
    } else if (isBootstrapCheckpointRequest) {
      encodedFileId = encodedDocumentPath.slice(
        0,
        -BOOTSTRAP_CHECKPOINT_SUFFIX.length
      )
    }
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
      if (isBootstrapCheckpointRequest) {
        if (request.method !== 'GET') {
          response.setHeader('allow', 'GET')
          sendJson(response, 405, {
            error: 'Document bootstrap checkpoint method is unsupported'
          })
          return
        }
        if (typeof readBootstrapCheckpoint !== 'function') {
          sendJson(response, 503, {
            error: 'Document bootstrap checkpoint reader is unavailable'
          })
          return
        }
        const checkpoint = await readBootstrapCheckpoint(fileId)
        sendJson(response, 200, checkpoint)
        return
      }

      if (isPersistenceBatchRequest) {
        if (request.method !== 'POST') {
          response.setHeader('allow', 'POST')
          sendJson(response, 405, {
            error: 'Document persistence batch method is unsupported'
          })
          return
        }
        if (typeof materializePersistenceBatch !== 'function') {
          sendJson(response, 503, {
            error: 'Document persistence materializer is unavailable'
          })
          return
        }
        const batch = await readJsonBody(request)
        if (
          typeof batch !== 'object' ||
          batch === null ||
          batch.documentId !== fileId
        ) {
          sendJson(response, 400, {
            error: 'Document persistence batch identity is invalid'
          })
          return
        }
        const acknowledgement = await materializePersistenceBatch(batch)
        sendJson(response, 200, acknowledgement)
        return
      }

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
