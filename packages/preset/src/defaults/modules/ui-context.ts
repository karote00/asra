import { registerUIContextProperties } from '../../ui/register-properties.js'
import type { PresetDefaultInstallContext } from '../types.js'
import {
  acquireBaseProperties,
  acquireFrameworkEvents,
  acquireUIContextProjection
} from '../installation.js'

export const installUIContextDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireBaseProperties(context)
  acquireFrameworkEvents(context)
  registerUIContextProperties(context.core)
  acquireUIContextProjection(context)
}
