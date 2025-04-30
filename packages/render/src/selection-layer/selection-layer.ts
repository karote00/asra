import { Container, Graphics, Matrix } from 'pixi.js'
import { getSelectionWorldBounds, getSelectionLocalBounds } from './utils'
import { SceneElement } from '../types'

interface SelectionLayerOptions {
  getSelectedElements: () => SceneElement[]
  getHoverElement: () => SceneElement | null
}

/**
 * A special layer responsible for rendering selection boxes.
 * Includes both selected and hover targets.
 */
export class SelectionLayer {
  layer: Container
  private selectedBox: Graphics
  private hoverBox: Graphics
  private getSelectedElements: () => SceneElement[]
  private getHoverElement: () => SceneElement | null

  constructor(options: SelectionLayerOptions) {
    this.layer = new Container()

    this.selectedBox = new Graphics()
    this.selectedBox.label = 'SelectedBox'
    this.hoverBox = new Graphics()
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

    if (selectedElements.length === 0) return

    if (selectedElements.length === 1) {
      const element = selectedElements[0]

      this.selectedBox
        .rect(0, 0, element.width, element.height)
        .stroke({ width: 1, color: 0x1e90ff })

      this.selectedBox.x = element.x
      this.selectedBox.y = element.y
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
