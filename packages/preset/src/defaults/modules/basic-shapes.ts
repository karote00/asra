import {
  BASIC_SHAPE_COMPONENT_DEFINITIONS,
  BASIC_SHAPE_RENDER_STRATEGY_REGISTRATIONS
} from '../../components/index.js'
import type { PresetDefaultInstallContext } from '../types.js'
import {
  acquireBaseProperties,
  acquireFrameworkEvents,
  acquireRenderSceneProjection,
  installComponentsAndStrategies
} from '../installation.js'

export const installBasicShapesDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireFrameworkEvents(context)
  acquireBaseProperties(context)
  installComponentsAndStrategies(
    context,
    BASIC_SHAPE_COMPONENT_DEFINITIONS,
    BASIC_SHAPE_RENDER_STRATEGY_REGISTRATIONS
  )
  acquireRenderSceneProjection(context)
}
