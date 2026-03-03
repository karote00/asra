import type { PositionData } from '@asyra/utils'
import type { PresetCoreAPIs, PresetDependencies } from '../types'

let hasRegistered = false

export const registerDefaultRenderSystemSubscriptions = (
  core: PresetCoreAPIs,
  deps: PresetDependencies
): void => {
  if (hasRegistered) {
    return
  }

  const zoomObservable = core.getSystemPropertyObservable<number>('zoom')
  const viewportPositionObservable =
    core.registerSystemProperty<PositionData>(
      'viewportPosition',
      { x: 0, y: 0 }
    )

  zoomObservable?.subscribe((scale) => {
    if (scale !== undefined) {
      deps.render.zoomTo(scale)
    }
  })

  viewportPositionObservable?.subscribe((position) => {
    if (position) {
      deps.render.panTo(position.x, position.y)
    }
  })

  hasRegistered = true
}
