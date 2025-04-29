import { Container, Graphics, Matrix } from 'pixi.js'
import {
  getSelectionWorldBounds,
  getSelectionLocalBounds,
  SceneElement
} from './utils'

interface SelectionLayerOptions {
  getSelectedElements: () => SceneElement[]
  getHoverElement: () => SceneElement | null
}

/**
 * A special layer responsible for rendering selection boxes.
 * Includes both selected and hover targets.
 */
export class SelectionLayer extends Container {
  private selectedBox: Graphics
  private hoverBox: Graphics
  private getSelectedElements: () => SceneElement[]
  private getHoverElement: () => SceneElement | null

  constructor(options: SelectionLayerOptions) {
    super()

    this.selectedBox = new Graphics()
    this.selectedBox.label = 'SelectedBox'
    this.hoverBox = new Graphics()
    this.hoverBox.label = 'HoverBox'

    this.addChild(this.selectedBox)
    this.addChild(this.hoverBox)

    this.getSelectedElements = options.getSelectedElements
    this.getHoverElement = options.getHoverElement
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

    if (selectedElements.length === 1) {
      const element = selectedElements[0]
      const bounds = getSelectionLocalBounds(element)

      this.selectedBox
        .rect(0, 0, bounds.width, bounds.height)
        .stroke({ width: 20, color: 0x1e90ff })
      this.selectedBox.x = bounds.x
      this.selectedBox.y = bounds.y

      const matrix = element.worldTransform.clone()
      this.selectedBox.setTransform(matrix)
    } else {
      const bounds = getSelectionWorldBounds(selectedElements)
      if (!bounds) return

      this.selectedBox.setTransform(new Matrix()) // Reset any transform
      this.selectedBox.lineStyle(1, 0x00ffff, 1) // Cyan color
      this.selectedBox.drawRect(bounds.x, bounds.y, bounds.width, bounds.height)
    }
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
}
