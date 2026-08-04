import {
  VECTOR_COMPONENT_DEFINITIONS,
  VECTOR_RENDER_STRATEGY_REGISTRATIONS
} from '../../components/index.js'
import type { PresetDefaultInstallContext } from '../types.js'
import {
  acquireFrameworkEvents,
  acquireRenderSceneProjection,
  acquireVectorProperties,
  installComponentsAndStrategies
} from '../installation.js'

export const installVectorDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireFrameworkEvents(context)
  acquireVectorProperties(context)
  installComponentsAndStrategies(
    context,
    VECTOR_COMPONENT_DEFINITIONS,
    VECTOR_RENDER_STRATEGY_REGISTRATIONS
  )
  acquireRenderSceneProjection(context)
}
