import {
  CONTAINER_COMPONENT_DEFINITIONS,
  CONTAINER_RENDER_STRATEGY_REGISTRATIONS
} from '../../components'
import type { PresetDefaultInstallContext } from '../types'
import {
  acquireBaseProperties,
  acquireFrameworkEvents,
  acquireRenderSceneProjection,
  installComponentsAndStrategies
} from '../helpers'

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
