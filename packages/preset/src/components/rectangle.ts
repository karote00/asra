import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_RECTANGLE_FILLS } from './fills'

defineComponent({
  type: 'rect',
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
    },
    {
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: DEFAULT_RECTANGLE_FILLS
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()
    graphic.rect(0, 0, data.width, data.height)
    applyRenderableFill(graphic, data.fills)
    graphic.x = data.x
    graphic.y = data.y
  }
})
