import type { PropertyComponentDefinition } from '@asyra/core'
import type { PresetCoreAPIs } from '../../types.js'
import { anchorPointPropertyComponentDefinition } from './anchor-point-component.js'
import { anchorPointsPropertyComponentDefinition } from './anchor-points-component.js'
import { customPropertyComponentDefinition } from './custom-component.js'
import { dimensionPropertyComponentDefinition } from './dimension-component.js'
import { fillPropertyComponentDefinition } from './fill-component.js'
import { fillsPropertyComponentDefinition } from './fills-component.js'
import { positionPropertyComponentDefinition } from './position-component.js'
import { strokePropertyComponentDefinition } from './stroke-component.js'
import { strokesPropertyComponentDefinition } from './strokes-component.js'
import { vectorNetworkPropertyComponentDefinition } from './vector-network-component.js'
import { vectorNetworksPropertyComponentDefinition } from './vector-networks-component.js'
import { vectorPointPropertyComponentDefinition } from './vector-point-component.js'
import { vectorPointsPropertyComponentDefinition } from './vector-points-component.js'
import { vectorSegmentPropertyComponentDefinition } from './vector-segment-component.js'
import { vectorSegmentsPropertyComponentDefinition } from './vector-segments-component.js'
import { PRESET_REGISTRATION } from '../../registration.js'

export const BASE_PROPERTY_COMPONENT_DEFINITIONS: readonly PropertyComponentDefinition[] =
  [
    positionPropertyComponentDefinition,
    dimensionPropertyComponentDefinition,
    fillPropertyComponentDefinition,
    fillsPropertyComponentDefinition,
    strokePropertyComponentDefinition,
    strokesPropertyComponentDefinition
  ]

export const VECTOR_PROPERTY_COMPONENT_DEFINITIONS: readonly PropertyComponentDefinition[] =
  [
    customPropertyComponentDefinition,
    anchorPointPropertyComponentDefinition,
    anchorPointsPropertyComponentDefinition,
    vectorPointPropertyComponentDefinition,
    vectorPointsPropertyComponentDefinition,
    vectorSegmentPropertyComponentDefinition,
    vectorSegmentsPropertyComponentDefinition,
    vectorNetworkPropertyComponentDefinition,
    vectorNetworksPropertyComponentDefinition
  ]

export const DEFAULT_PROPERTY_COMPONENT_DEFINITIONS: readonly PropertyComponentDefinition[] =
  [
    ...BASE_PROPERTY_COMPONENT_DEFINITIONS,
    ...VECTOR_PROPERTY_COMPONENT_DEFINITIONS
  ]

export const registerPropertyComponents = (
  core: Pick<PresetCoreAPIs, 'definePropertyComponent'>,
  definitions: readonly PropertyComponentDefinition[] = DEFAULT_PROPERTY_COMPONENT_DEFINITIONS
): void => {
  definitions.forEach((definition) => {
    core.definePropertyComponent({
      ...definition,
      registration: {
        ...PRESET_REGISTRATION,
        relations: definition.registration?.relations
      }
    })
  })
}
