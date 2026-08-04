import type { CoreRawData } from '@asyra/utils'
import { createEmptyDocument } from './empty-document'

export const CRDT_7076_DEMO_FILE_ID = 'crdt-7076-sample'
export const CRDT_7076_DEMO_RESET_STORAGE_KEY = `ASYRA_DEMO_RESET_DOCUMENT:${CRDT_7076_DEMO_FILE_ID}`

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

interface DemoDocumentStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

interface DemoResetOptions {
  readonly reload?: () => void
  readonly storage?: DemoDocumentStorage
}

const getPlatformFetch = (): DemoDocumentFetch => {
  if (typeof globalThis.fetch !== 'function') {
    throw new Error('[demo-document] fetch is unavailable')
  }
  return globalThis.fetch.bind(globalThis) as unknown as DemoDocumentFetch
}

const getPlatformStorage = (): DemoDocumentStorage => {
  if (typeof globalThis.localStorage === 'undefined') {
    throw new Error('[demo-document] localStorage is unavailable')
  }
  return globalThis.localStorage
}

const loadDemoResetDocument = (
  fileId: string,
  storage: DemoDocumentStorage
): CoreRawData | null => {
  if (fileId !== CRDT_7076_DEMO_FILE_ID) return null
  const serialized = storage.getItem(CRDT_7076_DEMO_RESET_STORAGE_KEY)
  return serialized ? (JSON.parse(serialized) as CoreRawData) : null
}

export const resetDemoDocument = (
  fileId: string,
  options: DemoResetOptions = {}
): void => {
  if (fileId !== CRDT_7076_DEMO_FILE_ID) {
    throw new Error(
      '[demo-document] Reset is only available for the crdt-7076 demo'
    )
  }

  const storage = options.storage ?? getPlatformStorage()
  storage.setItem(
    CRDT_7076_DEMO_RESET_STORAGE_KEY,
    JSON.stringify(createEmptyDocument())
  )
  const reload = options.reload ?? (() => window.location.reload())
  reload()
}

export const createInitialDocumentForFile = async (
  fileId: string,
  fetch: DemoDocumentFetch = getPlatformFetch(),
  storage: DemoDocumentStorage = getPlatformStorage()
): Promise<CoreRawData> => {
  const resetDocument = loadDemoResetDocument(fileId, storage)
  if (resetDocument) return resetDocument

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
