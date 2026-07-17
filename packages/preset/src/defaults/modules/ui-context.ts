import { registerUIContextProperties } from '../../ui/register-properties'
import type { PresetDefaultInstallContext } from '../types'
import { acquireFrameworkEvents, acquireUIContextProjection } from '../helpers'

export const installUIContextDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireFrameworkEvents(context)
  registerUIContextProperties(context.core)
  acquireUIContextProjection(context)
}
