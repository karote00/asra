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

  const zoomObservable = core.registerSystemProperty<number>('zoom', 1, {
    silent: true,
    runtime: true
  })
  const viewportPositionObservable =
    core.registerSystemProperty<PositionData>(
      'viewportPosition',
      { x: 0, y: 0 },
      {
        silent: true,
        runtime: true
      }
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
