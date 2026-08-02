import type { CanvasPipelineDebugger } from '@asyra/core/canvas-pipeline-debugger'
import core from '../../contexts'

let activeHandle: CanvasPipelineDebugger | undefined
let initializationId = 0

export const getActiveCanvasPipelineDebugger = ():
  | CanvasPipelineDebugger
  | undefined => activeHandle

const disposeActiveHandle = (): void => {
  const handle = activeHandle
  activeHandle = undefined
  delete window.__CanvasPipelineDebugger__
  handle?.dispose()
}

export const initCanvasPipelineDebugger = async (): Promise<
  CanvasPipelineDebugger | undefined
> => {
  if (!import.meta.env.DEV) {
    return
  }
  const requestId = ++initializationId
  try {
    disposeActiveHandle()
    const { createCanvasPipelineDebugger } = await import(
      '@asyra/core/canvas-pipeline-debugger'
    )
    if (requestId !== initializationId) {
      return
    }
    const handle = createCanvasPipelineDebugger(core, { enabled: false })
    activeHandle = handle
    window.__CanvasPipelineDebugger__ = handle
    return handle
  } catch (error) {
    console.error('[canvas-pipeline-debugger] failed to load', error)
    return
  }
}

export const destroyCanvasPipelineDebugger = (): void => {
  initializationId += 1
  disposeActiveHandle()
}

if (import.meta.hot) {
  import.meta.hot.dispose(destroyCanvasPipelineDebugger)
}
