import { defineComponent } from '../define-component'
import { PropertyTypes } from '@asyra/utils'

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
    graphic.fill(0xcccccc)

    // Ensure graphic is rendered (force update in E2E)
    // This might be needed for headless rendering
    graphic.renderable = true
    graphic.visible = true
  }
})
