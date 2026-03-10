import core, { render, systemContext, sceneTree } from '../contexts'
import type {
  ActiveGradientFillState,
  GradientHandleState
} from '../common-apis/system-context'
import { registerGradientFillHandlesRenderLayer } from '../render-layers/gradient-fill-handles-render-layer'

let hasInit = false

export const initGradientFillEditing = () => {
  if (hasInit) {
    return
  }

  core.defineSystemProperty<ActiveGradientFillState | null>(
    'activeGradientFill',
    null
  )
  core.defineSystemProperty<GradientHandleState | null>(
    'hoveredGradientHandle',
    null
  )
  core.defineSystemProperty<GradientHandleState | null>(
    'selectedGradientHandle',
    null
  )

  registerGradientFillHandlesRenderLayer(
    (registration, options) => core.registerRenderLayer(registration, options),
    {
      render,
      sceneTree,
      systemContext
    }
  )

  hasInit = true
}
