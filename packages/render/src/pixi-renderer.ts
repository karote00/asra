import { IRenderer, RenderOptions, RenderResult } from './types/renderer'
import render, { Render } from './render'

/**
 * PixiJS Renderer Adapter
 * Implements IRenderer interface using @asyra/render's PixiJS-based Render class
 */
export class PixiJSRenderer implements IRenderer {
  readonly name = 'PixiJSRenderer'

  private container: HTMLElement | null = null

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  constructor() {}

  async init(
    container: HTMLElement,
    options: RenderOptions
  ): Promise<RenderResult> {
    this.container = container

    const app = await render.init(
      options.width,
      options.height,
      options.backgroundColor || 0x000000
    )

    if (app.canvas && container) {
      container.appendChild(app.canvas)
    }

    return {
      canvas: app.canvas,
      instance: app
    }
  }

  destroy(): void {
    if (this.container) {
      this.container.innerHTML = ''
    }
    this.container = null
  }

  getViewportPosition() {
    const pos = render.getViewportPosition()
    return { x: pos.x, y: pos.y }
  }

  getViewportScale() {
    return render.getViewportScale()
  }

  setViewportPosition(x: number, y: number): void {
    render.panTo(x, y)
  }

  setViewportScale(scale: number, centerX: number, centerY: number): void {
    render.zoomToCenter(scale, centerX, centerY)
  }

  resize(width: number, height: number): void {
    // TODO: implement resize
  }

  getCanvas(): HTMLCanvasElement | null {
    const r = render as Render
    return r.app?.canvas ?? null
  }

  getInstance(): unknown {
    const r = render as Render
    return r.app
  }
}

export default PixiJSRenderer
