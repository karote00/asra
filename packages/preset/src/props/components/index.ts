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

export const DEFAULT_PROPERTY_COMPONENT_DEFINITIONS: readonly PropertyComponentDefinition[] =
  [
    positionPropertyComponentDefinition,
    dimensionPropertyComponentDefinition,
    customPropertyComponentDefinition,
    fillPropertyComponentDefinition,
    fillsPropertyComponentDefinition,
    strokePropertyComponentDefinition,
    strokesPropertyComponentDefinition,
    anchorPointPropertyComponentDefinition,
    anchorPointsPropertyComponentDefinition,
    vectorPointPropertyComponentDefinition,
    vectorPointsPropertyComponentDefinition,
    vectorSegmentPropertyComponentDefinition,
    vectorSegmentsPropertyComponentDefinition,
    vectorNetworkPropertyComponentDefinition,
    vectorNetworksPropertyComponentDefinition
  ]

export const registerPropertyComponents = (
  core: Pick<PresetCoreAPIs, 'definePropertyComponent'>
): void => {
  DEFAULT_PROPERTY_COMPONENT_DEFINITIONS.forEach((definition) => {
    core.definePropertyComponent({
      ...definition,
      registration: {
        ...PRESET_REGISTRATION,
        relations: definition.registration?.relations
      }
    })
  })
}
