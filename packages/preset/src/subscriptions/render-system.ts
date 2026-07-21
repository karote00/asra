import type { Subscription } from 'rxjs'
import type { PositionData } from '@asyra/utils'
import type { PresetCoreAPIs, PresetDependencies } from '../types'
import { createCleanupReporter } from '../cleanup-reporter'
import { PresetSystemPropertyKeys } from '../system-property-keys'

export const registerDefaultRenderSystemSubscriptions = (
  core: PresetCoreAPIs,
  deps: PresetDependencies,
  onCleanupReady?: (dispose: () => void) => void
): (() => void) => {
  const subscriptions: Subscription[] = []
  let disposed = false
  const dispose = (): void => {
    if (disposed) return
    for (let index = subscriptions.length - 1; index >= 0; index--) {
      subscriptions[index].unsubscribe()
      subscriptions.splice(index, 1)
    }
    disposed = true
  }
  const cleanupReporter = createCleanupReporter(onCleanupReady, dispose)
  const zoomObservable = core.getSystemPropertyObservable<number>(
    PresetSystemPropertyKeys.ZOOM
  )
  const viewportPositionObservable = core.defineSystemProperty<PositionData>(
    PresetSystemPropertyKeys.VIEWPORT_POSITION,
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
      cleanupReporter.report()
    }

    subscriptions.push(
      viewportPositionObservable.subscribe((position) => {
        if (position) {
          deps.render.panTo(position.x, position.y)
        }
      })
    )
    cleanupReporter.report()
  } catch (error) {
    if (!cleanupReporter.hasReported()) dispose()
    throw error
  }

  return dispose
}
