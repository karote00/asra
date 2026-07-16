import systemContext from '@asyra/system-context'
import { getElementGeometryWorldBounds } from '@asyra/utils'
import { getSelectionLocalBounds, getSelectionWorldBounds } from './utils'
import { SceneElement } from '../../types'
import { RenderContainer, RenderGraphics } from '../../types/render-object'

interface SelectionLayerOptions {
  getSelectedElements: () => SceneElement[]
  getHoverElement: () => SceneElement | null
}

/**
 * A special layer responsible for rendering selection boxes.
 * Includes both selected and hover targets.
 */
export class SelectionLayer {
  layer: RenderContainer
  private selectedBox: RenderGraphics
  private hoverBox: RenderGraphics
  private getSelectedElements: () => SceneElement[]
  private getHoverElement: () => SceneElement | null

  constructor(options: SelectionLayerOptions) {
    this.layer = new RenderContainer()

    this.selectedBox = new RenderGraphics()
    this.selectedBox.label = 'SelectedBox'
    this.hoverBox = new RenderGraphics()
    this.hoverBox.label = 'HoverBox'

    this.layer.addChild(this.selectedBox)
    this.layer.addChild(this.hoverBox)

    this.getSelectedElements = options.getSelectedElements
    this.getHoverElement = options.getHoverElement
  }

  get view() {
    return this.layer
  }

  /**
   * Manually trigger a redraw of selection boxes.
   */
  update() {
    this.updateSelectedBox()
    this.updateHoverBox()
  }

  updateSelected() {
    this.updateSelectedBox()
  }

  private updateSelectedBox() {
    const selectedElements = this.getSelectedElements()

    this.selectedBox.clear()
    if (selectedElements.length === 0) return

    const pathEditingVectorId =
      systemContext.getManagedProperty<string | null>('pathEditingVectorId') ??
      null
    if (pathEditingVectorId) {
      return
    }

    if (selectedElements.length === 1) {
      const element = selectedElements[0]
      const bounds = getElementGeometryWorldBounds(element)

      this.selectedBox.rect(0, 0, bounds.width, bounds.height).stroke({
        width: 1,
        color: 0x1e90ff
      })

      this.selectedBox.x = bounds.x
      this.selectedBox.y = bounds.y
      return
    }

    const multiBounds = getSelectionWorldBounds(selectedElements)
    if (!multiBounds) {
      return
    }

    this.selectedBox.rect(0, 0, multiBounds.width, multiBounds.height).stroke({
      width: 1,
      color: 0x1e90ff
    })
    this.selectedBox.x = multiBounds.x
    this.selectedBox.y = multiBounds.y
  }

  private updateHoverBox() {
    const hoverElement = this.getHoverElement()
    this.hoverBox.clear()

    if (!hoverElement) return

    const bounds = getSelectionLocalBounds(hoverElement)

    this.hoverBox.lineStyle(1, 0xffa500, 1) // Orange color
    this.hoverBox.drawRect(bounds.x, bounds.y, bounds.width, bounds.height)

    const matrix = hoverElement.worldTransform.clone()
    this.hoverBox.setTransform(matrix)
  }

  get viewportZoom() {
    return this.layer.parent?.scale.x ?? 1
  }
}
