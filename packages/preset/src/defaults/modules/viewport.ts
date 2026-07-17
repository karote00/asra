import { registerDefaultRenderSystemSubscriptions } from '../../subscriptions'
import { registerViewportProperties } from '../../ui/register-properties'
import type { PresetDefaultInstallContext } from '../types'

export const installViewportDefault = (
  context: PresetDefaultInstallContext
): void => {
  registerViewportProperties(context.core)
  context.privatePrerequisites.acquire('subscriptions:viewport', () =>
    registerDefaultRenderSystemSubscriptions(context.core, context.dependencies)
  )
}
