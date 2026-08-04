import { registerInputProperties } from '../../ui/register-properties.js'
import type { PresetDefaultInstallContext } from '../types.js'
import { acquireInputEvents } from '../installation.js'

export const installInputDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireInputEvents(context)
  registerInputProperties(context.core)
}
