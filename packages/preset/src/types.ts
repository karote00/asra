import type { Core } from '@asyra/core'

export type PresetDependencies = ReturnType<Core['getPresetDependencies']>

export interface PresetCoreAPIs {
  registerEvent: Core['registerEvent']
  registerRenderLayer: Core['registerRenderLayer']
  registerDataChannelObserver?: Core['registerDataChannelObserver']
  unregisterDataChannelObserver?: Core['unregisterDataChannelObserver']
  registerPropertySchema: Core['registerPropertySchema']
  registerSelection: Core['registerSelection']
  getSelection: Core['getSelection']
  registerUIProperty: Core['registerUIProperty']
  registerSystemProperty: Core['registerSystemProperty']
  getPresetDependencies?: () => PresetDependencies
}
