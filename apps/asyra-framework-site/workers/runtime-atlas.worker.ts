/// <reference lib="webworker" />

import { createAtlasRuntime } from '@/lib/runtime-atlas/runtime.mjs'

type AtlasRuntimeSnapshot = Awaited<
  ReturnType<ReturnType<typeof createAtlasRuntime>['advance']>
>

type AtlasWorkerRequest =
  | { id: number; type: 'start'; caseId: string }
  | { id: number; type: 'advance' }
  | { id: number; type: 'dispose' }

type AtlasWorkerResponse =
  | { id: number; ok: true; snapshot?: AtlasRuntimeSnapshot }
  | {
      id: number
      ok: false
      error: { name: string; message: string }
    }

let runtime: ReturnType<typeof createAtlasRuntime> | undefined

const respond = (response: AtlasWorkerResponse) => postMessage(response)

self.addEventListener(
  'message',
  async (event: MessageEvent<AtlasWorkerRequest>) => {
    const request = event.data
    try {
      if (request.type === 'start') {
        await runtime?.dispose()
        runtime = createAtlasRuntime(request.caseId)
        respond({ id: request.id, ok: true, snapshot: runtime.snapshot() })
        return
      }
      if (request.type === 'advance') {
        if (!runtime) {
          throw new Error('Runtime Atlas worker has not started a case')
        }
        respond({ id: request.id, ok: true, snapshot: await runtime.advance() })
        return
      }
      await runtime?.dispose()
      runtime = undefined
      respond({ id: request.id, ok: true })
      self.close()
    } catch (error) {
      respond({
        id: request.id,
        ok: false,
        error: {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'UnknownError'
        }
      })
    }
  }
)
