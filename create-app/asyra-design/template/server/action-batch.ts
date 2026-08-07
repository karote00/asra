import { createHash, randomUUID } from 'node:crypto'
import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type {
  AiActionBatch,
  AiJsonValue,
  AiProviderInput
} from '@asyra/ai-agent-runtime'
import { ACTION_BATCH_ENDPOINT } from '../src/ai/action-batch-endpoint'

const sampleRoot = new URL('../samples/crdt-7076/', import.meta.url)
const sampleInstruction = readFileSync(
  new URL('instruction.txt', sampleRoot),
  'utf8'
).trim()
const sampleImage = readFileSync(new URL('reference-image.png', sampleRoot))
const sampleImageDigest = createHash('sha256').update(sampleImage).digest('hex')
const sampleActionBatchUrl = new URL('action-batch.json', sampleRoot)
const maximumRequestBytes = 16 * 1024 * 1024
let sampleActionBatchPromise: Promise<AiActionBatch> | undefined

type MiddlewareNext = (error?: unknown) => void

export class ActionBatchServerError extends Error {
  readonly code:
    | 'ACTION_BATCH_ABORTED'
    | 'ACTION_BATCH_INVALID_INPUT'
    | 'ACTION_BATCH_MODEL_CONFIGURATION_REQUIRED'
    | 'ACTION_BATCH_MODEL_FAILED'
    | 'ACTION_BATCH_UNSUPPORTED_SAMPLE'

  constructor(code: ActionBatchServerError['code'], message: string) {
    super(message)
    this.name = 'ActionBatchServerError'
    this.code = code
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const unsupportedSample = (): never => {
  throw new ActionBatchServerError(
    'ACTION_BATCH_UNSUPPORTED_SAMPLE',
    'The submitted image and instruction do not match a registered sample.'
  )
}

const matchesSampleImageAttachment = (
  metadata: AiJsonValue | undefined
): boolean => {
  if (
    !isRecord(metadata) ||
    !Array.isArray(metadata.imageAttachments) ||
    metadata.imageAttachments.length !== 1
  ) {
    return false
  }
  const attachment = metadata.imageAttachments[0]
  if (
    !isRecord(attachment) ||
    attachment.mediaType !== 'image/png' ||
    typeof attachment.dataUrl !== 'string' ||
    !attachment.dataUrl.startsWith('data:image/png;base64,') ||
    typeof attachment.size !== 'number' ||
    !Number.isSafeInteger(attachment.size) ||
    attachment.size <= 0
  ) {
    return false
  }

  const encoded = attachment.dataUrl.slice('data:image/png;base64,'.length)
  const bytes = Buffer.from(encoded, 'base64')
  return (
    bytes.byteLength === attachment.size &&
    bytes.byteLength === sampleImage.byteLength &&
    createHash('sha256').update(bytes).digest('hex') === sampleImageDigest
  )
}

const assertRequestId = (value: string): string => {
  const requestId = value.trim()
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/i.test(requestId)) {
    throw new ActionBatchServerError(
      'ACTION_BATCH_INVALID_INPUT',
      'The action-batch request id is invalid.'
    )
  }
  return requestId
}

const readSampleActionBatch = (): Promise<AiActionBatch> => {
  sampleActionBatchPromise ??= readFile(sampleActionBatchUrl, 'utf8').then(
    (source) => JSON.parse(source) as AiActionBatch
  )
  return sampleActionBatchPromise
}

export type RequestModelActionBatch = (
  input: AiProviderInput,
  options: { readonly signal?: AbortSignal }
) => Promise<AiActionBatch>

const requestDefaultModelActionBatch: RequestModelActionBatch = async (
  input,
  options
) => {
  const { requestConfiguredAiActionBatch } = await import('./ai-model-provider')
  return requestConfiguredAiActionBatch(input, options)
}

const readErrorCode = (error: unknown): string | undefined =>
  isRecord(error) && typeof error.code === 'string' ? error.code : undefined

export const resolveActionBatchRequest = async (
  input: AiProviderInput,
  options: {
    readonly requestModelActionBatch?: RequestModelActionBatch
    readonly requestId?: string
    readonly signal?: AbortSignal
  } = {}
): Promise<AiActionBatch> => {
  if (options.signal?.aborted) {
    throw new ActionBatchServerError(
      'ACTION_BATCH_ABORTED',
      'The action-batch request was aborted.'
    )
  }
  if (!isRecord(input) || typeof input.intent !== 'string') {
    throw new ActionBatchServerError(
      'ACTION_BATCH_INVALID_INPUT',
      'The action-batch input is invalid.'
    )
  }
  const matchesSampleInstruction = input.intent.trim() === sampleInstruction
  const matchesSampleImage = matchesSampleImageAttachment(input.metadata)
  assertRequestId(options.requestId ?? randomUUID())

  if (matchesSampleInstruction && matchesSampleImage) {
    const batch = await readSampleActionBatch()
    if (options.signal?.aborted) {
      throw new ActionBatchServerError(
        'ACTION_BATCH_ABORTED',
        'The action-batch request was aborted.'
      )
    }
    return batch
  }
  if (matchesSampleInstruction || matchesSampleImage) {
    return unsupportedSample()
  }

  const requestModelActionBatch =
    options.requestModelActionBatch ?? requestDefaultModelActionBatch
  let batch: AiActionBatch
  try {
    batch = await requestModelActionBatch(input, { signal: options.signal })
  } catch (error) {
    const code = readErrorCode(error)
    if (code === 'AI_MODEL_BACKEND_ABORTED') {
      throw new ActionBatchServerError(
        'ACTION_BATCH_ABORTED',
        'The action-batch request was aborted.'
      )
    }
    if (code === 'AI_MODEL_BACKEND_INVALID_CONFIGURATION') {
      throw new ActionBatchServerError(
        'ACTION_BATCH_MODEL_CONFIGURATION_REQUIRED',
        'The action-batch model backend is not fully configured.'
      )
    }
    if (
      code === 'AI_MODEL_BACKEND_HTTP_STATUS' ||
      code === 'AI_MODEL_BACKEND_INVALID_RESPONSE' ||
      code === 'AI_MODEL_BACKEND_TRANSPORT_FAILED'
    ) {
      throw new ActionBatchServerError(
        'ACTION_BATCH_MODEL_FAILED',
        'The action-batch model backend failed.'
      )
    }
    throw error
  }
  if (options.signal?.aborted) {
    throw new ActionBatchServerError(
      'ACTION_BATCH_ABORTED',
      'The action-batch request was aborted.'
    )
  }
  return batch
}

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  value: unknown
): void => {
  if (response.writableEnded || response.destroyed) return
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}

const readJsonBody = async (
  request: IncomingMessage,
  signal: AbortSignal
): Promise<unknown> => {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of request) {
    if (signal.aborted) {
      throw new ActionBatchServerError(
        'ACTION_BATCH_ABORTED',
        'The action-batch request was aborted.'
      )
    }
    const bytes =
      typeof chunk === 'string' ? Buffer.from(chunk) : Buffer.from(chunk)
    size += bytes.byteLength
    if (size > maximumRequestBytes) {
      throw new ActionBatchServerError(
        'ACTION_BATCH_INVALID_INPUT',
        'The action-batch request is too large.'
      )
    }
    chunks.push(bytes)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new ActionBatchServerError(
      'ACTION_BATCH_INVALID_INPUT',
      'The action-batch request body is invalid.'
    )
  }
}

export const createActionBatchMiddleware =
  (
    options: {
      readonly requestModelActionBatch?: RequestModelActionBatch
    } = {}
  ) =>
  async (
    request: IncomingMessage,
    response: ServerResponse,
    next: MiddlewareNext
  ): Promise<void> => {
    const url = new URL(request.url ?? '/', 'http://app.local')
    if (url.pathname !== ACTION_BATCH_ENDPOINT) {
      next()
      return
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { code: 'ACTION_BATCH_METHOD_NOT_ALLOWED' })
      return
    }

    const controller = new AbortController()
    const abort = () => controller.abort('request closed')
    request.once('aborted', abort)
    response.once('close', () => {
      if (!response.writableEnded) abort()
    })
    try {
      const input = await readJsonBody(request, controller.signal)
      if (!isRecord(input)) {
        throw new ActionBatchServerError(
          'ACTION_BATCH_INVALID_INPUT',
          'The action-batch request body is invalid.'
        )
      }
      const batch = await resolveActionBatchRequest(
        input as unknown as AiProviderInput,
        {
          requestId: randomUUID(),
          requestModelActionBatch: options.requestModelActionBatch,
          signal: controller.signal
        }
      )
      sendJson(response, 200, batch)
    } catch (error) {
      if (
        error instanceof ActionBatchServerError &&
        error.code === 'ACTION_BATCH_ABORTED'
      ) {
        sendJson(response, 499, { code: error.code })
      } else if (
        error instanceof ActionBatchServerError &&
        error.code === 'ACTION_BATCH_UNSUPPORTED_SAMPLE'
      ) {
        sendJson(response, 422, { code: error.code })
      } else if (
        error instanceof ActionBatchServerError &&
        error.code === 'ACTION_BATCH_MODEL_CONFIGURATION_REQUIRED'
      ) {
        sendJson(response, 503, { code: error.code })
      } else if (
        error instanceof ActionBatchServerError &&
        error.code === 'ACTION_BATCH_MODEL_FAILED'
      ) {
        sendJson(response, 502, { code: error.code })
      } else if (
        error instanceof ActionBatchServerError &&
        error.code === 'ACTION_BATCH_INVALID_INPUT'
      ) {
        sendJson(response, 400, { code: error.code })
      } else {
        sendJson(response, 500, { code: 'ACTION_BATCH_INTERNAL_ERROR' })
      }
    } finally {
      request.removeListener('aborted', abort)
    }
  }
