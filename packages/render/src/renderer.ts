import type { Render } from './render.js'
import render from './render.js'
import type {
  IRenderer,
  RenderOptions,
  RenderResult
} from './types/renderer.js'

let didWarnAboutPixiJSRenderer = false

export class RenderAdapter implements IRenderer {
  readonly name: string = 'RenderAdapter'

  private container: HTMLElement | null = null
  private initializationPending = false
  private destroyRequested = false

  constructor(private readonly runtime: Render = render) {}

  async init(
    container: HTMLElement,
    options: RenderOptions
  ): Promise<RenderResult> {
    this.container = container
    this.destroyRequested = false
    this.initializationPending = true

    try {
      const app = await this.runtime.init(
        options.width,
        options.height,
        options.backgroundColor || 0x000000,
        container
      )
      if (this.destroyRequested) {
        this.runtime.dispose()
        throw new Error('Render adapter was destroyed during initialization')
      }
      this.runtime.start()

      return {
        canvas: app.canvas,
        instance: app.instance
      }
    } finally {
      this.initializationPending = false
    }
  }

  destroy(): void {
    const container = this.container
    if (!container) {
      return
    }
    this.container = null
    this.destroyRequested = true
    if (this.initializationPending) {
      container.innerHTML = ''
      return
    }
    try {
      this.runtime.dispose()
    } finally {
      container.innerHTML = ''
    }
  }

  getViewportPosition() {
    const position = this.runtime.getViewportPosition()
    return { x: position.x, y: position.y }
  }

  getViewportScale() {
    return this.runtime.getViewportScale()
  }

  setViewportPosition(x: number, y: number): void {
    this.runtime.panTo(x, y)
  }

  setViewportScale(scale: number, centerX: number, centerY: number): void {
    this.runtime.zoomToCenter(scale, centerX, centerY)
  }

  resize(width: number, height: number): void {
    this.runtime.resize(width, height)
  }

  getCanvas(): HTMLCanvasElement | null {
    return this.runtime.app?.canvas ?? null
  }

  getInstance(): unknown {
    return this.runtime.app?.instance
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
