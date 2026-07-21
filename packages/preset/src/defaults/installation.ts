import type {
  ComponentDefinition,
  RenderLayerRegistration,
  RenderStrategy
} from '@asyra/core'
import { SharedDataChannelNames } from '@asyra/utils'
import {
  BASE_PROPERTY_COMPONENT_DEFINITIONS,
  registerPropertyComponents,
  VECTOR_PROPERTY_COMPONENT_DEFINITIONS
} from '../props/components'
import {
  BASE_PROPERTY_SCHEMAS,
  registerPropertySchemas,
  VECTOR_PROPERTY_SCHEMAS
} from '../props/register-property-schemas'
import {
  FrameworkEventDefinitions,
  BasicInputEventDefinitions
} from '../events/preset-event-names'
import { registerEvents } from '../events/register-events'
import { registerDefaultSharedDataChannels } from '../subscriptions/shared-channels'
import { registerDefaultDataChannelObservers } from '../subscriptions/data-channel'
import type { PresetRenderStrategyRegistration } from '../components'
import type { PresetDefaultInstallContext } from './types'

export const acquireFrameworkEvents = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('events:framework', () =>
    registerEvents(
      context.core,
      undefined,
      Object.values(FrameworkEventDefinitions)
    )
  )
}

export const acquireInputEvents = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('events:input', () =>
    registerEvents(
      context.core,
      undefined,
      Object.values(BasicInputEventDefinitions)
    )
  )
}

export const acquireBaseProperties = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('properties:base', (): undefined => {
    registerPropertySchemas(context.core, BASE_PROPERTY_SCHEMAS)
    registerPropertyComponents(
      context.core,
      BASE_PROPERTY_COMPONENT_DEFINITIONS
    )
  })
}

export const acquireVectorProperties = (
  context: PresetDefaultInstallContext
): void => {
  acquireBaseProperties(context)
  context.privatePrerequisites.acquire('properties:vector', (): undefined => {
    registerPropertySchemas(context.core, VECTOR_PROPERTY_SCHEMAS)
    registerPropertyComponents(
      context.core,
      VECTOR_PROPERTY_COMPONENT_DEFINITIONS
    )
  })
}

export const acquireRenderSceneProjection = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('channels:render-scene', () =>
    registerDefaultSharedDataChannels(context.core, undefined, [
      SharedDataChannelNames.SCENE_TREE,
      SharedDataChannelNames.PROPS
    ])
  )
  context.privatePrerequisites.acquire('observers:render-scene', () =>
    registerDefaultDataChannelObservers(
      context.core,
      context.dependencies,
      undefined,
      { renderScene: true }
    )
  )
}

export const acquireSelectionProjection = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('channels:selection', () =>
    registerDefaultSharedDataChannels(context.core, undefined, [
      SharedDataChannelNames.SELECTION
    ])
  )
  context.privatePrerequisites.acquire('observers:selection', () =>
    registerDefaultDataChannelObservers(
      context.core,
      context.dependencies,
      undefined,
      { selection: true }
    )
  )
}

export const acquireVectorEditingProjection = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('channels:selection', () =>
    registerDefaultSharedDataChannels(context.core, undefined, [
      SharedDataChannelNames.SELECTION
    ])
  )
  context.privatePrerequisites.acquire('observers:vector-editing', () =>
    registerDefaultDataChannelObservers(
      context.core,
      context.dependencies,
      undefined,
      { vectorEditing: true }
    )
  )
}

export const acquireUIContextProjection = (
  context: PresetDefaultInstallContext
): void => {
  context.privatePrerequisites.acquire('channels:ui-context', () =>
    registerDefaultSharedDataChannels(context.core, undefined, [
      SharedDataChannelNames.SCENE_TREE,
      SharedDataChannelNames.SELECTION,
      SharedDataChannelNames.PROPS
    ])
  )
  context.privatePrerequisites.acquire('observers:ui-context', () =>
    registerDefaultDataChannelObservers(
      context.core,
      context.dependencies,
      undefined,
      { uiContext: true }
    )
  )
}

export const installComponentsAndStrategies = (
  context: PresetDefaultInstallContext,
  definitions: readonly ComponentDefinition[],
  strategies: readonly PresetRenderStrategyRegistration[]
): void => {
  definitions.forEach((definition) => context.core.defineComponent(definition))
  strategies.forEach(({ type, strategy, registration }) => {
    context.core.registerRenderStrategy(
      type,
      strategy as RenderStrategy,
      registration
    )
  })
}

export const registerTrackedRenderLayer = (
  context: PresetDefaultInstallContext,
  install: (register: (registration: RenderLayerRegistration) => void) => void
): (() => void) => {
  const registeredNames: string[] = []
  const dispose = (): void => {
    for (let index = registeredNames.length - 1; index >= 0; index--) {
      context.core.unregisterRenderLayer(registeredNames[index])
      registeredNames.splice(index, 1)
    }
  }

  try {
    install((registration) => {
      context.core.registerRenderLayer(registration)
      registeredNames.push(registration.name)
    })
  } catch (error) {
    dispose()
    throw error
  }
  return dispose
}
