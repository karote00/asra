import { decodeRestrictedGlb } from './decode'

interface DecodeRequest {
  id: number
  bytes: ArrayBuffer
}

self.addEventListener(
  'message',
  async (event: MessageEvent<DecodeRequest>) => {
    const request = event.data
    try {
      if (
        !request ||
        !Number.isSafeInteger(request.id) ||
        !(request.bytes instanceof ArrayBuffer)
      )
        throw new Error('Invalid GLB worker request')
      const asset = await decodeRestrictedGlb(new Uint8Array(request.bytes))
      self.postMessage({ id: request.id, ok: true, asset })
    } catch (error) {
      self.postMessage({
        id: request?.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      self.close()
    }
  },
  { once: true }
)
