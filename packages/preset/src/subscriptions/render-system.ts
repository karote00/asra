import type { Subscription } from 'rxjs'
import type { PositionData } from '@asyra/utils'
import type { PresetCoreAPIs, PresetDependencies } from '../types'

export const registerDefaultRenderSystemSubscriptions = (
  core: PresetCoreAPIs,
  deps: PresetDependencies,
  onCleanupReady?: (dispose: () => void) => void
): (() => void) => {
  const subscriptions: Subscription[] = []
  let disposed = false
  let cleanupReported = false
  const dispose = (): void => {
    if (disposed) return
    for (let index = subscriptions.length - 1; index >= 0; index--) {
      subscriptions[index].unsubscribe()
      subscriptions.splice(index, 1)
    }
    disposed = true
  }
  const reportCleanupReady = (): void => {
    if (cleanupReported || !onCleanupReady) return
    onCleanupReady(dispose)
    cleanupReported = true
  }
  const zoomObservable = core.getSystemPropertyObservable<number>('zoom')
  const viewportPositionObservable = core.defineSystemProperty<PositionData>(
    'viewportPosition',
    { x: 0, y: 0 }
  )

  try {
    if (zoomObservable) {
      subscriptions.push(
        zoomObservable.subscribe((scale) => {
          if (scale !== undefined) {
            deps.render.zoomTo(scale)
          }
        })
      )
      reportCleanupReady()
    }

    subscriptions.push(
      viewportPositionObservable.subscribe((position) => {
        if (position) {
          deps.render.panTo(position.x, position.y)
        }
      })
    )
    reportCleanupReady()
  } catch (error) {
    if (!cleanupReported) dispose()
    throw error
  }

  return dispose
}
