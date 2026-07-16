import type { PropertyComponentDefinition } from '@asyra/core'
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
