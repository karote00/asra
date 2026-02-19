import { Application, Container, Graphics, Ticker } from 'pixi.js'
import { DataTypes, MouseData } from '@asyra/utils'
import { RenderElementData, RenderContainerData, SceneElement } from './types'
import { ViewportLayer } from './viewport-layer'
import { SelectionLayer } from './selection-layer'
import renderSelection from './stores/selection'
import systemContext from '@asyra/system-context'
import sceneTree from '@asyra/scene-tree'

const ticker = Ticker.shared
const PEN_PREVIEW_COLOR = 0x9ca3af
const PEN_PREVIEW_WIDTH = 2

interface AnchorPointLike {
  x: number
  y: number
}

interface WorkspacePoint {
  x: number
  y: number
}

interface PenPreviewSegment {
  from: WorkspacePoint
  to: WorkspacePoint
}

class Render {
  app: Application | null = null
  viewport: ViewportLayer
  selection: SelectionLayer
  penPreview: Graphics
  private _tickerActive: boolean = false
  private _animateHandler: () => void

  constructor() {
    this.viewport = new ViewportLayer()
    this.selection = new SelectionLayer({
      getSelectedElements: this.getSelectedElements.bind(this),
      getHoverElement: () => null
    })
    this.penPreview = new Graphics()
    this.penPreview.label = 'PenPreviewLayer'
    this.selection.view.addChild(this.penPreview)

    // Don't auto-start ticker in constructor to support controlled initialization
    this._tickerActive = false
    this._animateHandler = () => {
      this.updateLayers()
    }
  }

  start() {
    if (this._tickerActive) {
      console.warn('Render ticker already started')
      return
    }

    this.run()
    this._tickerActive = true
  }

  stop() {
    if (!this._tickerActive) {
      return
    }

    ticker.remove(this._animateHandler)
    this._tickerActive = false
  }

  run() {
    ticker.add(this._animateHandler)
  }

  updateLayers() {
    this.updatePenPreview()
    this.viewport.syncVectorPointScale()
    this.selection.update()
  }

  private createApplication() {
    const app = new Application()

    return app
  }

  async init(width: number, height: number, backgroundColor: number) {
    const app = this.createApplication()

    await app.init({
      width,
      height,
      backgroundColor,
      resolution: Math.min(window.devicePixelRatio, 2),
      resizeTo: window,
      antialias: true,
      autoDensity: true
    })

    this.app = app
    this.app.stage.eventMode = 'static'

    this._setupStageLayers()

    return this.app
  }

  private _setupStageLayers() {
    this.app?.stage.addChild(this.viewport.view)
    this.app?.stage.addChild(this.selection.view)
  }

  getSelectedElements(): SceneElement[] {
    return [...renderSelection.elementSelection].map((elementId) =>
      this.viewport.getElementById(elementId)
    ) as SceneElement[]
  }

  getAllElementsBounds() {
    return this.viewport.getAllElementsBounds()
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    this.viewport.switchWorkspace(workspaceData)
  }

  addContainer(containerData: RenderContainerData) {
    return this.viewport.addContainer(containerData)
  }

  addElement(data: RenderElementData) {
    return this.viewport.addElement(data)
  }

  removeElement(elementId: string, parentId?: string) {
    return this.viewport.removeElement(elementId, parentId)
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes,
    data?: RenderElementData
  ) {
    this.viewport.updateElement(elementId, key, before, after, data)
  }

  updateElementProperties(
    element: Container | Graphics,
    key: string,
    after: DataTypes
  ) {
    this.viewport.updateElementProperties(element, key, after)
  }

  /**
   * Zoom to fit all elements within the specified UI bounds
   * @param uiBounds - The DOMRect representing the visible canvas area
   * @returns void
   */
  zoomFit(uiBounds: DOMRect) {
    this.viewport.zoomFit(uiBounds)
  }

  /**
   * Move the canvas to the specified position
   * @param x - The x-coordinate to move the canvas to
   * @param y - The y-coordinate to move the canvas to
   * @returns void
   */
  panTo(x: number, y: number) {
    this.viewport.panTo(x, y)
  }

  /**
   * Set the canvas zoom level
   * @param scale - The zoom scale factor. A value of 1.0 represents 100% zoom.
   *               Values greater than 1.0 zoom in, values less than 1.0 zoom out.
   * @returns void
   */
  zoomTo(scale: number) {
    this.viewport.zoomTo(scale)
  }

  /**
   * Set the canvas zoom level centered on a specific point
   * @param scale - The zoom scale factor
   * @param centerX - The x-coordinate of the zoom center
   * @param centerY - The y-coordinate of the zoom center
   * @returns void
   */
  zoomToCenter(scale: number, centerX: number, centerY: number) {
    this.viewport.zoomToCenter(scale, centerX, centerY)
  }

  getViewportPosition() {
    return this.viewport.getPosition()
  }

  getViewportScale() {
    return this.viewport.getScale()
  }

  getMousePosInWorkspace(mousePos: MouseData) {
    return this.viewport.getMousePosInWorkspace(mousePos)
  }

  private toWorkspacePoint(
    point: AnchorPointLike,
    computed: {
      x?: number
      y?: number
      width?: number
      height?: number
    }
  ): WorkspacePoint {
    const x = typeof computed.x === 'number' ? computed.x : 0
    const y = typeof computed.y === 'number' ? computed.y : 0
    const width = typeof computed.width === 'number' ? computed.width : 0
    const height = typeof computed.height === 'number' ? computed.height : 0
    const isLikelyLocal =
      point.x >= -1 &&
      point.x <= width + 1 &&
      point.y >= -1 &&
      point.y <= height + 1

    if (!isLikelyLocal) {
      return { x: point.x, y: point.y }
    }

    return { x: point.x + x, y: point.y + y }
  }

  private getPenPreviewSegment(): PenPreviewSegment | null {
    const snapshot = systemContext.getSystemContextSnapshot()
    if (snapshot.primaryTool !== 'pen') {
      return null
    }

    const pathEditingVectorId = systemContext.getManagedProperty<string | null>(
      'pathEditingVectorId'
    )
    if (!pathEditingVectorId) {
      return null
    }

    const element = sceneTree.getElementById(pathEditingVectorId)
    if (!element || element.get('type') !== 'vector') {
      return null
    }

    const computed = element.getAllComputedData() as {
      x?: number
      y?: number
      width?: number
      height?: number
      anchorPoints?: AnchorPointLike[]
    }
    const anchorPoints = computed.anchorPoints
    if (!Array.isArray(anchorPoints) || anchorPoints.length === 0) {
      return null
    }

    const lastPoint = this.toWorkspacePoint(
      anchorPoints[anchorPoints.length - 1],
      computed
    )
    const mouseWorkspacePos = this.viewport.getMousePosInWorkspace({
      clientX: snapshot.mouse.position.x,
      clientY: snapshot.mouse.position.y
    })

    return { from: lastPoint, to: mouseWorkspacePos }
  }

  private toScreenPoint(point: WorkspacePoint): WorkspacePoint {
    const viewportScale = this.viewport.getScale()
    const viewportPosition = this.viewport.getPosition()

    return {
      x: point.x * viewportScale + viewportPosition.x,
      y: point.y * viewportScale + viewportPosition.y
    }
  }

  private updatePenPreview() {
    this.penPreview.clear()

    const segment = this.getPenPreviewSegment()
    if (!segment) {
      return
    }

    const from = this.toScreenPoint(segment.from)
    const to = this.toScreenPoint(segment.to)

    this.penPreview.moveTo(from.x, from.y)
    this.penPreview.lineTo(to.x, to.y)
    if (
      'stroke' in this.penPreview &&
      typeof this.penPreview.stroke === 'function'
    ) {
      this.penPreview.stroke({
        width: PEN_PREVIEW_WIDTH,
        color: PEN_PREVIEW_COLOR,
        cap: 'round',
        join: 'round'
      })
    }
  }

  dispose() {
    this.stop()

    if (this.app) {
      this.app.destroy(true)
      this.app = null
    }
  }

  reset() {
    this.dispose()
    this.app = null
  }
}

const render = new Render()

export default render
export { Render }
