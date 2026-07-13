import { defineComponent } from '@asyra/core'
import { EntityTypes, PropertyTypes, createDefaultFills } from '@asyra/utils'
import { DEFAULT_GROUP_STROKES } from './stroke-defaults'

defineComponent({
  type: EntityTypes.GROUP,
  idPrefix: 'grp',
  namePrefix: 'Group',
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
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    // No visual rendering for group itself besides updating position
    graphic.x = data.x
    graphic.y = data.y
  }
})
