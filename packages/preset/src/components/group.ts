import { defineComponent } from '@asyra/core'
import { EntityTypes, PropertyTypes } from '@asyra/utils'

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
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    // No visual rendering for group itself besides updating position
    graphic.x = data.x
    graphic.y = data.y
  }
})
