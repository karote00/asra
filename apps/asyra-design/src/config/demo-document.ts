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
  let sampleUrl: string | null = null
  if (fileId === CRDT_7076_DEMO_FILE_ID) {
    sampleUrl = crdt7076DocumentUrl
  }
  if (!sampleUrl) {
    return createEmptyDocument()
  }

  const response = await fetch(sampleUrl)
  if (!response.ok) {
    throw new Error(
      `[demo-document] sample load failed with status ${String(
        response.status
      )}`
    )
  }

  const deliveredDocument = await response.arrayBuffer()
  const deliveredBytes = new Uint8Array(deliveredDocument)
  const isGzip = deliveredBytes[0] === 0x1f && deliveredBytes[1] === 0x8b
  let serializedDocument: string
  if (isGzip) {
    const compressedStream = new Response(deliveredDocument).body
    if (!compressedStream) {
      throw new Error('[demo-document] compressed sample stream is unavailable')
    }
    const decompressedStream = compressedStream.pipeThrough(
      new DecompressionStream('gzip')
    )
    serializedDocument = await new Response(decompressedStream).text()
  } else {
    // Browsers transparently decode a response carrying Content-Encoding:
    // gzip. Static hosts that deliver the file as opaque bytes retain the
    // gzip magic header and use the branch above.
    serializedDocument = new TextDecoder().decode(deliveredBytes)
  }

  // Compression only packages the canonical document for static delivery.
  // Core.load remains the schema and canonical validation owner.
  return JSON.parse(serializedDocument) as CoreRawData
}
