import type { Render } from './render'
import render from './render'
import type { IRenderer, RenderOptions, RenderResult } from './types/renderer'

let didWarnAboutPixiJSRenderer = false

export class RenderAdapter implements IRenderer {
  readonly name: string = 'RenderAdapter'

  private container: HTMLElement | null = null

  async init(
    container: HTMLElement,
    options: RenderOptions
  ): Promise<RenderResult> {
    this.container = container

    const app = await render.init(
      options.width,
      options.height,
      options.backgroundColor || 0x000000,
      container
    )
    render.start()

    return {
      canvas: app.canvas,
      instance: app
    }
  }

  destroy(): void {
    const container = this.container
    if (!container) {
      return
    }
    this.container = null
    try {
      render.dispose()
    } finally {
      container.innerHTML = ''
    }
  }

  getViewportPosition() {
    const position = render.getViewportPosition()
    return { x: position.x, y: position.y }
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
    render.resize(width, height)
  }

  getCanvas(): HTMLCanvasElement | null {
    return (render as Render).app?.canvas ?? null
  }

  getInstance(): unknown {
    return (render as Render).app?.instance
  }
}

/**
 * @deprecated Use `RenderAdapter` from `@asyra/render`. This compatibility
 * alias will be removed in the next planned major release after the migration
 * window.
 */
export class PixiJSRenderer extends RenderAdapter {
  readonly name: string = 'PixiJSRenderer'

  constructor() {
    super()
    if (!didWarnAboutPixiJSRenderer) {
      console.warn(
        'PixiJSRenderer is deprecated. Use RenderAdapter from @asyra/render.'
      )
      didWarnAboutPixiJSRenderer = true
    }
  }
}

export default RenderAdapter
