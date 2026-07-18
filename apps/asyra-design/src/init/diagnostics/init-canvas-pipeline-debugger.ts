import type { CanvasPipelineDebugger } from '@asyra/core/canvas-pipeline-debugger'
import core from '../../contexts'

let activeHandle: CanvasPipelineDebugger | undefined
let initializationId = 0

const disposeActiveHandle = (): void => {
  const handle = activeHandle
  activeHandle = undefined
  delete window.__AsyraCanvasPipelineDebugger__
  handle?.dispose()
}

export const initCanvasPipelineDebugger = async (): Promise<
  CanvasPipelineDebugger | undefined
> => {
  if (!import.meta.env.DEV) {
    return undefined
  }
  const requestId = ++initializationId
  try {
    disposeActiveHandle()
    const { createCanvasPipelineDebugger } = await import(
      '@asyra/core/canvas-pipeline-debugger'
    )
    if (requestId !== initializationId) {
      return undefined
    }
    const handle = createCanvasPipelineDebugger(core, { enabled: false })
    activeHandle = handle
    window.__AsyraCanvasPipelineDebugger__ = handle
    return handle
  } catch (error) {
    console.error(
      '[Asyra Design] Canvas Pipeline Debugger failed to load',
      error
    )
    return undefined
  }
}

export const destroyCanvasPipelineDebugger = (): void => {
  initializationId += 1
  disposeActiveHandle()
}

if (import.meta.hot) {
  import.meta.hot.dispose(destroyCanvasPipelineDebugger)
}
