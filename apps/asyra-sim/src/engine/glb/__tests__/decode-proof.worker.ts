import { decodeRestrictedGlb } from '../decode'

/** Permanent feasibility fixture: no Core, renderer, or worker reuse. */
self.addEventListener(
  'message',
  async (event: MessageEvent<Uint8Array>) => {
    const start = performance.now()
    try {
      const asset = await decodeRestrictedGlb(event.data)
      self.postMessage({ asset, elapsedMs: performance.now() - start })
    } catch (error) {
      self.postMessage({
        error: error instanceof Error ? error.message : String(error)
      })
    } finally {
      self.close()
    }
  },
  { once: true }
)
