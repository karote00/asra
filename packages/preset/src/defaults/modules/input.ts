import { registerInputProperties } from '../../ui/register-properties'
import type { PresetDefaultInstallContext } from '../types'
import { acquireInputEvents } from '../helpers'

export const installInputDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireInputEvents(context)
  registerInputProperties(context.core)
}
