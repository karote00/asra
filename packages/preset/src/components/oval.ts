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

    // Set explicit dimensions BEFORE drawing for E2E hit detection
    // This ensures the Graphics object has correct bounds for selection/hover in headless mode
    graphic.width = data.width
    graphic.height = data.height

    // Set position BEFORE drawing (order might matter for initialization)
    graphic.x = data.x
    graphic.y = data.y

    // Draw ellipse
    graphic.ellipse(
      data.width / 2,
      data.height / 2,
      data.width / 2,
      data.height / 2
    )
    applyRenderableFill(graphic, data.fills)

    // Ensure graphic is rendered (force update in E2E)
    // This might be needed for headless rendering
    graphic.renderable = true
    graphic.visible = true
  }
})
