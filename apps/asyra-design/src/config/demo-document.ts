import type { CoreRawData } from '@asyra/utils'
import { createEmptyDocument } from './empty-document'

export const CRDT_7076_DEMO_FILE_ID = 'crdt-7076-sample'

const crdt7076DocumentUrl = new URL(
  '../../samples/crdt-7076/document.json.gz',
  import.meta.url
).href

interface DemoDocumentResponse {
  readonly ok: boolean
  readonly status: number
  arrayBuffer(): Promise<ArrayBuffer>
}

type DemoDocumentFetch = (input: string) => Promise<DemoDocumentResponse>

const getPlatformFetch = (): DemoDocumentFetch => {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('[demo-document] fetch is unavailable')
  }
  return globalThis.fetch.bind(globalThis) as unknown as DemoDocumentFetch
}

export const createInitialDocumentForFile = async (
  fileId: string,
  fetch: DemoDocumentFetch = getPlatformFetch()
): Promise<CoreRawData> => {
  if (fileId !== CRDT_7076_DEMO_FILE_ID) {
    return createEmptyDocument()
  }

  const response = await fetch(crdt7076DocumentUrl)
  if (!response.ok) {
    throw new Error(
      `[demo-document] 7,076 sample load failed with status ${String(
        response.status
      )}`
    )
  }

  const compressedDocument = await response.arrayBuffer()
  const compressedStream = new Response(compressedDocument).body
  if (!compressedStream) {
    throw new Error('[demo-document] compressed sample stream is unavailable')
  }
  const decompressedStream = compressedStream.pipeThrough(
    new DecompressionStream('gzip')
  )
  const serializedDocument = await new Response(decompressedStream).text()

  // Compression only packages the canonical document for static delivery.
  // Core.load remains the schema and canonical validation owner.
  return JSON.parse(serializedDocument) as CoreRawData
}
