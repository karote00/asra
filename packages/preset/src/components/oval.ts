import { defineComponent } from '@asyra/core'
import { PropertyTypes } from '@asyra/utils'
import { applyRenderableFill, DEFAULT_OVAL_FILLS } from './fills'

defineComponent({
  type: 'oval',
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
    },
    {
      name: 'fills',
      type: PropertyTypes.FILLS,
      defaultValue: DEFAULT_OVAL_FILLS
    }
  ],
  renderStrategy: (graphic, data) => {
    graphic.clear()

    // Draw ellipse
    graphic.ellipse(
      data.width / 2,
      data.height / 2,
      data.width / 2,
      data.height / 2
    )
    applyRenderableFill(graphic, data.fills)

    graphic.x = data.x
    graphic.y = data.y

    // Ensure graphic is rendered (force update in E2E)
    graphic.renderable = true
    graphic.visible = true
  }
})
