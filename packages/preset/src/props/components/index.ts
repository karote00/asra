import type { PropertyComponentDefinition } from '@asyra/core'
import type { PresetCoreAPIs } from '../../types'
import { anchorPointPropertyComponentDefinition } from './anchor-point-component'
import { anchorPointsPropertyComponentDefinition } from './anchor-points-component'
import { customPropertyComponentDefinition } from './custom-component'
import { dimensionPropertyComponentDefinition } from './dimension-component'
import { fillPropertyComponentDefinition } from './fill-component'
import { fillsPropertyComponentDefinition } from './fills-component'
import { positionPropertyComponentDefinition } from './position-component'
import { strokePropertyComponentDefinition } from './stroke-component'
import { strokesPropertyComponentDefinition } from './strokes-component'
import { vectorNetworkPropertyComponentDefinition } from './vector-network-component'
import { vectorNetworksPropertyComponentDefinition } from './vector-networks-component'
import { vectorPointPropertyComponentDefinition } from './vector-point-component'
import { vectorPointsPropertyComponentDefinition } from './vector-points-component'
import { vectorSegmentPropertyComponentDefinition } from './vector-segment-component'
import { vectorSegmentsPropertyComponentDefinition } from './vector-segments-component'
import { PRESET_REGISTRATION } from '../../registration'

export const BASE_PROPERTY_COMPONENT_DEFINITIONS: readonly PropertyComponentDefinition[] =
  [
    positionPropertyComponentDefinition,
    dimensionPropertyComponentDefinition,
    customPropertyComponentDefinition,
    fillPropertyComponentDefinition,
    fillsPropertyComponentDefinition,
    strokePropertyComponentDefinition,
    strokesPropertyComponentDefinition
  ]

export const VECTOR_PROPERTY_COMPONENT_DEFINITIONS: readonly PropertyComponentDefinition[] =
  [
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
