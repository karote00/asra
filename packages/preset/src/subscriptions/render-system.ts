import { renderSceneTreeStore } from '@asyra/core'
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
  const strokeDebugDisableVisualOverlapCollapseObservable =
    core.getSystemPropertyObservable<boolean>(
      'strokeDebugDisableVisualOverlapCollapse'
    )
  const viewportPositionObservable = core.defineSystemProperty<PositionData>(
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

  let strokeDebugInitialValueSeen = false
  strokeDebugDisableVisualOverlapCollapseObservable?.subscribe(() => {
    if (!strokeDebugInitialValueSeen) {
      strokeDebugInitialValueSeen = true
      return
    }

    renderSceneTreeStore.reload()
  })

  hasRegistered = true
}
