import { defineComponent } from '../define-component'
import { EntityTypes, PropertyTypes } from '@asyra/utils'

defineComponent({
  type: EntityTypes.OVAL,
  idPrefix: 'oval',
  namePrefix: 'Oval',
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
      .ellipse(data.width / 2, data.height / 2, data.width / 2, data.height / 2)
      .fill(0xcccccc)
    graphic.x = data.x
    graphic.y = data.y
  }
})
