import { defineComponent } from '@asyra/core'
import { EntityTypes, PropertyTypes } from '@asyra/utils'

defineComponent({
  type: EntityTypes.FRAME,
  idPrefix: 'fr',
  namePrefix: 'Frame',
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
    graphic
      .rect(0, 0, data.width, data.height)
      .fill(0xffffff)
      .stroke({ color: 0x000000, width: 1 })
    graphic.x = data.x
    graphic.y = data.y
  }
})
