import core from '../../contexts'
import type { AreaSelectionState } from '../../common-apis/system-context'
import { viewportApis } from '../../common-apis/viewport'
import { registerAreaSelectionRenderLayer } from '../../render-layers/area-selection-render-layer'

let hasInit = false

export const initAreaSelection = () => {
  if (hasInit) {
    return
  }

  core.defineSystemProperty<AreaSelectionState | null>('areaSelection', null)

  registerAreaSelectionRenderLayer(
    (registration, options) => core.registerRenderLayer(registration, options),
    {
      systemProperties: core,
      viewportApis
    }
  )

  hasInit = true
}
