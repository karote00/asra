/// <reference lib="webworker" />

import {
  advanceAtlasRun,
  createAtlasRun,
  disposeAtlasRun,
  getAtlasRunSnapshot,
  type AtlasRunHandle
} from '../lib/runtime-atlas/runtime.mjs'

type RuntimeCommand =
  | Readonly<{ type: 'initialize'; caseId: string }>
  | Readonly<{ type: 'step' }>
  | Readonly<{ type: 'dispose' }>

let activeRun: AtlasRunHandle | undefined

const postFailure = (error: unknown) => {
  self.postMessage({
    type: 'failure',
    error: error instanceof Error ? error.message : String(error)
  })
}

self.addEventListener('message', (event: MessageEvent<RuntimeCommand>) => {
  void (async () => {
    try {
      if (event.data.type === 'initialize') {
        if (activeRun) await disposeAtlasRun(activeRun)
        activeRun = await createAtlasRun(event.data.caseId)
        self.postMessage({
          type: 'snapshot',
          snapshot: getAtlasRunSnapshot(activeRun)
        })
        return
      }
      if (event.data.type === 'dispose') {
        if (activeRun) await disposeAtlasRun(activeRun)
        activeRun = undefined
        self.postMessage({ type: 'disposed' })
        self.close()
        return
      }
      if (!activeRun) throw new Error('Runtime Atlas worker is not initialized')
      self.postMessage({
        type: 'snapshot',
        snapshot: await advanceAtlasRun(activeRun)
      })
    } catch (error) {
      postFailure(error)
    }
  })()
})

export {}
