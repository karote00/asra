import { defineComponent } from '../define-component'
import { EntityTypes, PropertyTypes } from '@asyra/utils'

defineComponent({
  type: EntityTypes.RECTANGLE,
  idPrefix: 'rect',
  namePrefix: 'Rectangle',
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
    graphic.rect(0, 0, data.width, data.height).fill(0xCCCCCC)
    graphic.x = data.x
    graphic.y = data.y
  }
})
