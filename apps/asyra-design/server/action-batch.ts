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

const readImageAttachment = (
  metadata: AiJsonValue | undefined
): {
  readonly bytes: Buffer
  readonly size: number
} => {
  if (
    !isRecord(metadata) ||
    !Array.isArray(metadata.imageAttachments) ||
    metadata.imageAttachments.length !== 1
  ) {
    return unsupportedSample()
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
    return unsupportedSample()
  }

  const encoded = attachment.dataUrl.slice('data:image/png;base64,'.length)
  const bytes = Buffer.from(encoded, 'base64')
  if (
    bytes.byteLength !== attachment.size ||
    bytes.byteLength !== sampleImage.byteLength ||
    createHash('sha256').update(bytes).digest('hex') !== sampleImageDigest
  ) {
    return unsupportedSample()
  }
  return { bytes, size: attachment.size }
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

export const resolveActionBatchRequest = async (
  input: AiProviderInput,
  options: {
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
  if (
    !isRecord(input) ||
    typeof input.intent !== 'string' ||
    input.intent.trim() !== sampleInstruction
  ) {
    return unsupportedSample()
  }
  readImageAttachment(input.metadata)
  assertRequestId(options.requestId ?? randomUUID())
  const batch = await readSampleActionBatch()
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
  () =>
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
      } else {
        sendJson(response, 400, { code: 'ACTION_BATCH_INVALID_INPUT' })
      }
    } finally {
      request.removeListener('aborted', abort)
    }
  }
