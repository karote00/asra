export type CooperativeRenderMode = 'progressive' | 'atomic'

export interface CooperativeRenderBatchOptions {
  readonly maxItemsPerSlice?: number
}

export interface CooperativeRenderOptions
  extends CooperativeRenderBatchOptions {
  readonly mode?: CooperativeRenderMode
  readonly waitForPaint?: () => Promise<void>
  readonly yieldToHost?: () => Promise<void>
}

export const DEFAULT_COOPERATIVE_RENDER_MAX_ITEMS_PER_SLICE = 1_024

interface CooperativeTaskScheduler {
  yield?: () => Promise<void>
}

export const resolveCooperativeRenderMode = (
  options: CooperativeRenderOptions = {}
): CooperativeRenderMode => options.mode ?? 'progressive'

export const resolveCooperativeRenderMaxItemsPerSlice = (
  options: CooperativeRenderBatchOptions = {}
): number => {
  const maxItemsPerSlice =
    options.maxItemsPerSlice ?? DEFAULT_COOPERATIVE_RENDER_MAX_ITEMS_PER_SLICE
  if (!Number.isSafeInteger(maxItemsPerSlice) || maxItemsPerSlice <= 0) {
    throw new Error(
      'Cooperative render maxItemsPerSlice must be a positive safe integer.'
    )
  }
  return maxItemsPerSlice
}

export const yieldToCooperativeHost = (): Promise<void> => {
  const scheduler = (
    globalThis as typeof globalThis & {
      scheduler?: CooperativeTaskScheduler
    }
  ).scheduler
  if (typeof scheduler?.yield === 'function') {
    return scheduler.yield()
  }

  if (typeof globalThis.MessageChannel === 'function') {
    return new Promise((resolve) => {
      const channel = new globalThis.MessageChannel()
      channel.port1.onmessage = () => {
        channel.port1.close()
        channel.port2.close()
        resolve()
      }
      channel.port2.postMessage(undefined)
    })
  }

  if (typeof globalThis.requestAnimationFrame === 'function') {
    return new Promise((resolve) => {
      globalThis.requestAnimationFrame(() => resolve())
    })
  }

  return Promise.reject(
    new Error('This environment does not support cooperative host scheduling.')
  )
}

export const waitForCooperativePaint = (): Promise<void> => {
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    return yieldToCooperativeHost()
  }

  return new Promise((resolve) => {
    globalThis.requestAnimationFrame(() => {
      globalThis.requestAnimationFrame(() => resolve())
    })
  })
}

export const settleCooperativeRenderSlice = async (
  options: CooperativeRenderOptions = {}
): Promise<void> => {
  if (resolveCooperativeRenderMode(options) === 'atomic') {
    return
  }

  await (options.yieldToHost ?? yieldToCooperativeHost)()
  await (options.waitForPaint ?? waitForCooperativePaint)()
}
