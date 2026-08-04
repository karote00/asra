import {
  CONTAINER_COMPONENT_DEFINITIONS,
  CONTAINER_RENDER_STRATEGY_REGISTRATIONS
} from '../../components/index.js'
import type { PresetDefaultInstallContext } from '../types.js'
import {
  acquireBaseProperties,
  acquireFrameworkEvents,
  acquireRenderSceneProjection,
  installComponentsAndStrategies
} from '../installation.js'

export const installContainersDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireFrameworkEvents(context)
  acquireBaseProperties(context)
  installComponentsAndStrategies(
    context,
    CONTAINER_COMPONENT_DEFINITIONS,
    CONTAINER_RENDER_STRATEGY_REGISTRATIONS
  )
  acquireRenderSceneProjection(context)
}
