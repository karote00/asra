import type { Core } from '@asyra/core'
import type { PositionData } from '@asyra/utils'

export interface PresetDependencies {
  sceneTree: {
    getElementById: (id: string) => {
      get: (key: string) => unknown
      getAllComputedData: () => unknown
    } | null | undefined
  }
  systemContext: {
    getManagedProperty: <T>(key: string) => T | undefined
    getSystemContextSnapshot: () => {
      primaryTool: string
      mouse: { position: PositionData }
    }
  }
  render: {
    getViewportPosition: () => PositionData
    getViewportScale: () => number
    getMousePosInWorkspace: (point: {
      clientX: number
      clientY: number
    }) => PositionData
  }
}

export interface PresetCoreAPIs {
  registerEvent: Core['registerEvent']
  registerRenderLayer: Core['registerRenderLayer']
  registerPropertySchema: Core['registerPropertySchema']
  registerSelection: Core['registerSelection']
  getSelection: Core['getSelection']
  registerUIProperty: <T>(
    key: string,
    config: {
      defaultValue: T
      aggregate?: boolean
      aggregateKey?: string
      compute?: (context: unknown) => T
      emptyValue?: T
      source$?: unknown
      triggers?: {
        action?: string
        key?: string
        onSelectionChange?: boolean
      }
    }
  ) => void
  registerSystemProperty: <T>(
    key: string,
    defaultValue: T,
    options?: {
      runtime?: boolean
      silent?: boolean
      validate?: (value: unknown) => value is T
    }
  ) => unknown
  getPresetDependencies?: () => PresetDependencies
}
