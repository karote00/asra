import { registerUIContextProperties } from '../../ui/register-properties'
import type { PresetDefaultInstallContext } from '../types'
import {
  acquireBaseProperties,
  acquireFrameworkEvents,
  acquireUIContextProjection
} from '../installation'

export const installUIContextDefault = (
  context: PresetDefaultInstallContext
): void => {
  acquireBaseProperties(context)
  acquireFrameworkEvents(context)
  registerUIContextProperties(context.core)
  acquireUIContextProjection(context)
}
