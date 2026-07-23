import type { ComponentDefinition, RenderStrategy } from '@asyra/core'
import { EntityTypes, PropertyTypes } from '@asyra/utils'
import {
  createPresetPropertyDependencies,
  createPresetRegistration
} from '../registration'
import {
  RECTANGLE_COMPONENT_DEFINITION,
  RECTANGLE_RENDER_STRATEGY
} from './rectangle'
import { OVAL_COMPONENT_DEFINITION, OVAL_RENDER_STRATEGY } from './oval'
import { VECTOR_COMPONENT_DEFINITION, VECTOR_RENDER_STRATEGY } from './vector'
import { FRAME_COMPONENT_DEFINITION, FRAME_RENDER_STRATEGY } from './frame'
import {
  GROUP_COMPONENT_DEFINITION,
  GROUP_RENDER_STRATEGY,
  deriveGroupBounds,
  groupElements,
  normalizeGroupsForElements,
  prepareGroupOperation,
  prepareUngroupOperation,
  ungroupElement
} from './group'

export {
  RECTANGLE_COMPONENT_DEFINITION,
  OVAL_COMPONENT_DEFINITION,
  VECTOR_COMPONENT_DEFINITION,
  FRAME_COMPONENT_DEFINITION,
  GROUP_COMPONENT_DEFINITION,
  RECTANGLE_RENDER_STRATEGY,
  OVAL_RENDER_STRATEGY,
  VECTOR_RENDER_STRATEGY,
  FRAME_RENDER_STRATEGY,
  GROUP_RENDER_STRATEGY,
  deriveGroupBounds,
  groupElements,
  normalizeGroupsForElements,
  prepareGroupOperation,
  prepareUngroupOperation,
  ungroupElement
}
export type {
  GroupBounds,
  GroupOperationCore,
  GroupOperationResult,
  GroupPlanningCore,
  NormalizedGroupBounds,
  PreparedGroupOperation,
  PreparedUngroupOperation,
  UngroupOperationResult
} from './group'

export const DEFAULT_COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = [
  RECTANGLE_COMPONENT_DEFINITION,
  OVAL_COMPONENT_DEFINITION,
  VECTOR_COMPONENT_DEFINITION,
  FRAME_COMPONENT_DEFINITION,
  GROUP_COMPONENT_DEFINITION
]

export const BASIC_SHAPE_COMPONENT_DEFINITIONS: readonly ComponentDefinition[] =
  [RECTANGLE_COMPONENT_DEFINITION, OVAL_COMPONENT_DEFINITION]

export const CONTAINER_COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = [
  FRAME_COMPONENT_DEFINITION,
  GROUP_COMPONENT_DEFINITION
]

export const VECTOR_COMPONENT_DEFINITIONS: readonly ComponentDefinition[] = [
  VECTOR_COMPONENT_DEFINITION
]

export interface PresetRenderStrategyRegistration {
  type: string
  strategy: RenderStrategy
  registration: ReturnType<typeof createPresetRegistration>
}

const renderRegistration = (
  definition: ComponentDefinition,
  strategy: RenderStrategy,
  propertyTypes: readonly string[]
): PresetRenderStrategyRegistration => ({
  type: definition.type,
  strategy,
  registration: createPresetRegistration(
    createPresetPropertyDependencies(propertyTypes)
  )
})

export const DEFAULT_RENDER_STRATEGY_REGISTRATIONS: readonly PresetRenderStrategyRegistration[] =
  [
    renderRegistration(
      RECTANGLE_COMPONENT_DEFINITION,
      RECTANGLE_RENDER_STRATEGY,
      [PropertyTypes.POSITION, PropertyTypes.DIMENSION, PropertyTypes.FILLS]
    ),
    renderRegistration(OVAL_COMPONENT_DEFINITION, OVAL_RENDER_STRATEGY, [
      PropertyTypes.POSITION,
      PropertyTypes.DIMENSION,
      PropertyTypes.FILLS
    ]),
    renderRegistration(VECTOR_COMPONENT_DEFINITION, VECTOR_RENDER_STRATEGY, [
      PropertyTypes.POSITION,
      PropertyTypes.DIMENSION,
      PropertyTypes.VECTOR_POINTS,
      PropertyTypes.VECTOR_SEGMENTS,
      PropertyTypes.VECTOR_NETWORKS,
      PropertyTypes.CUSTOM,
      PropertyTypes.FILLS,
      PropertyTypes.STROKES
    ]),
    renderRegistration(FRAME_COMPONENT_DEFINITION, FRAME_RENDER_STRATEGY, [
      PropertyTypes.POSITION,
      PropertyTypes.DIMENSION,
      PropertyTypes.FILLS
    ]),
    renderRegistration(GROUP_COMPONENT_DEFINITION, GROUP_RENDER_STRATEGY, [
      PropertyTypes.POSITION
    ])
  ]

export const BASIC_SHAPE_RENDER_STRATEGY_REGISTRATIONS =
  DEFAULT_RENDER_STRATEGY_REGISTRATIONS.slice(0, 2)

export const VECTOR_RENDER_STRATEGY_REGISTRATIONS =
  DEFAULT_RENDER_STRATEGY_REGISTRATIONS.slice(2, 3)

export const CONTAINER_RENDER_STRATEGY_REGISTRATIONS =
  DEFAULT_RENDER_STRATEGY_REGISTRATIONS.slice(3, 5)

export const DEFAULT_COMPONENT_TYPES = [
  'rect',
  'oval',
  'vector',
  EntityTypes.FRAME,
  EntityTypes.GROUP
] as const
