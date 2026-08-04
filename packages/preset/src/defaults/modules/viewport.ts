import { registerDefaultRenderSystemSubscriptions } from '../../subscriptions/index.js'
import { registerViewportProperties } from '../../ui/register-properties.js'
import type { PresetDefaultInstallContext } from '../types.js'

export const installViewportDefault = (
  context: PresetDefaultInstallContext
): void => {
  registerViewportProperties(context.core)
  context.privatePrerequisites.acquire('subscriptions:viewport', () =>
    registerDefaultRenderSystemSubscriptions(context.core, context.dependencies)
  )
}
