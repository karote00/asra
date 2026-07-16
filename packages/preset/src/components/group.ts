import type { ComponentDefinition, RenderStrategy } from '@asyra/core'
import { EntityTypes, PropertyTypes, createDefaultFills } from '@asyra/utils'
import { DEFAULT_GROUP_STROKES } from './stroke-defaults'
import { PRESET_REGISTRATION } from '../registration'

export const GROUP_COMPONENT_DEFINITION: ComponentDefinition = {
  type: EntityTypes.GROUP,
  idPrefix: 'grp',
  namePrefix: 'Group',
  registration: PRESET_REGISTRATION,
  isContainer: true,
  properties: [
    {
      name: PropertyTypes.POSITION,
      type: PropertyTypes.POSITION,
      alias: ['x', 'y']
    },
    {
      name: PropertyTypes.DIMENSION,
      type: PropertyTypes.DIMENSION,
      alias: ['width', 'height']
    },
    {
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: createDefaultFills({ color: '#cccccc', visible: false })
    },
    {
      name: 'strokes',
      type: PropertyTypes.STROKES,
      defaultValue: DEFAULT_GROUP_STROKES
    }
  ]
}

export const GROUP_RENDER_STRATEGY: RenderStrategy = (graphic, data) => {
  graphic.clear()
  // No visual rendering for group itself besides updating position
  graphic.x = data.x
  graphic.y = data.y
}
