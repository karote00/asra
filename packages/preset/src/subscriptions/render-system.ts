import type { Subscription } from 'rxjs'
import type { PositionData } from '@asyra/utils'
import type { PresetCoreAPIs, PresetDependencies } from '../types'

export const registerDefaultRenderSystemSubscriptions = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
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
    }

    subscriptions.push(
      viewportPositionObservable.subscribe((position) => {
        if (position) {
          deps.render.panTo(position.x, position.y)
        }
      })
    )
  } catch (error) {
    dispose()
    throw error
  }

  return dispose
}
