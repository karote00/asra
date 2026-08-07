import { Buffer } from 'node:buffer'
import { createRequire } from 'node:module'
import { Worker } from 'node:worker_threads'

export const VTRACER_ENDPOINT = '/api/ai-tools/vtracer'

const require = createRequire(import.meta.url)
const vtracerModulePath = require.resolve('@visioncortex/vtracer')
const acceptedContentTypes = new Set(['image/jpeg', 'image/png'])

export class VTracerServerError extends Error {
  constructor(code, message) {
    super(message)
    this.name = 'VTracerServerError'
    this.code = code
  }
}

const optionsForProfile = (profile) => {
  if (profile !== 'photo-faithful') {
    throw new VTracerServerError(
      'VTRACER_INVALID_INPUT',
      'VTracer profile is invalid.'
    )
  }
  return {
    hierarchical: 'stacked',
    mode: 'polygon',
    optimize: 0,
    pathPrecision: 2,
    preset: 'photo'
  }
}

const convertInWorker = (bytes, options, signal) =>
  new Promise((resolve, reject) => {
    const transferable = Uint8Array.from(bytes)
    const worker = new Worker(
      `
        const { parentPort, workerData } = require('node:worker_threads')
        const { convertBuffer } = require(workerData.modulePath)
        try {
          const svg = convertBuffer(
            new Uint8Array(workerData.bytes),
            workerData.options
          )
          parentPort.postMessage({ svg })
        } catch {
          parentPort.postMessage({ failed: true })
        }
      `,
      {
        eval: true,
        transferList: [transferable.buffer],
        workerData: {
          bytes: transferable.buffer,
          modulePath: vtracerModulePath,
          options
        }
      }
    )
    let settled = false
    const settle = (callback) => {
      if (settled) {
        return
      }
      settled = true
      signal.removeEventListener('abort', abort)
      callback()
    }
    const abort = () => {
      void worker.terminate()
      settle(() =>
        reject(
          new VTracerServerError(
            'VTRACER_ABORTED',
            'VTracer conversion was aborted.'
          )
        )
      )
    }
    signal.addEventListener('abort', abort, { once: true })
    worker.once('message', (message) => {
      void worker.terminate()
      settle(() => {
        if (
          typeof message !== 'object' ||
          message === null ||
          typeof message.svg !== 'string'
        ) {
          reject(
            new VTracerServerError(
              'VTRACER_FAILED',
              'VTracer conversion failed.'
            )
          )
          return
        }
        resolve(message.svg)
      })
    })
    worker.once('error', () => {
      settle(() =>
        reject(
          new VTracerServerError('VTRACER_FAILED', 'VTracer conversion failed.')
        )
      )
    })
    worker.once('exit', (code) => {
      if (code !== 0) {
        settle(() =>
          reject(
            new VTracerServerError(
              'VTRACER_FAILED',
              'VTracer conversion failed.'
            )
          )
        )
      }
    })
  })

export const convertVTracerBuffer = async ({
  bytes,
  contentType,
  profile,
  signal
}) => {
  if (signal.aborted) {
    throw new VTracerServerError(
      'VTRACER_ABORTED',
      'VTracer conversion was aborted.'
    )
  }
  if (
    !acceptedContentTypes.has(contentType) ||
    !(bytes instanceof Uint8Array) ||
    bytes.byteLength === 0
  ) {
    throw new VTracerServerError(
      'VTRACER_INVALID_INPUT',
      'VTracer request is invalid.'
    )
  }
  return convertInWorker(bytes, optionsForProfile(profile), signal)
}

const sendJson = (response, statusCode, code) => {
  if (response.writableEnded || response.destroyed) {
    return
  }
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify({ code }))
}

export const createVTracerMiddleware =
  () => async (request, response, next) => {
    const url = new globalThis.URL(request.url ?? '/', 'http://app.local')
    if (url.pathname !== VTRACER_ENDPOINT) {
      next()
      return
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, 'VTRACER_METHOD_NOT_ALLOWED')
      return
    }

    const controller = new globalThis.AbortController()
    const abort = () => controller.abort('request closed')
    request.once('aborted', abort)
    response.once('close', () => {
      if (!response.writableEnded) {
        abort()
      }
    })
    try {
      const chunks = []
      for await (const chunk of request) {
        chunks.push(
          typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
        )
      }
      const contentType = String(request.headers['content-type'] ?? '')
        .split(';', 1)[0]
        .trim()
        .toLocaleLowerCase('en-US')
      const profileHeader = request.headers['x-vtracer-profile']
      const profile = Array.isArray(profileHeader)
        ? profileHeader[0]
        : profileHeader
      const svg = await convertVTracerBuffer({
        bytes: Buffer.concat(chunks),
        contentType,
        profile,
        signal: controller.signal
      })
      if (!response.writableEnded && !response.destroyed) {
        response.statusCode = 200
        response.setHeader('content-type', 'image/svg+xml; charset=utf-8')
        response.end(svg)
      }
    } catch (error) {
      if (
        error instanceof VTracerServerError &&
        error.code === 'VTRACER_ABORTED'
      ) {
        sendJson(response, 499, error.code)
      } else if (
        error instanceof VTracerServerError &&
        error.code === 'VTRACER_INVALID_INPUT'
      ) {
        sendJson(response, 400, error.code)
      } else {
        sendJson(response, 422, 'VTRACER_FAILED')
      }
    } finally {
      request.removeListener('aborted', abort)
    }
  }
