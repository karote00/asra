/**
 * Renderer Interface for Framework
 * Allows users to swap between different rendering engines
 *
 * Built-in implementations:
 * - RenderAdapter (framework render adapter using the injected engine)
 *
 * Users can implement compatible custom renderers, including:
 * - Canvas2D (simple 2D)
 * - SVG renderer
 * - Custom specialized renderers
 */
export interface IRenderer {
  /**
   * Renderer name for identification
   */
  readonly name: string

  /**
   * Initialize the renderer
   * @param container - DOM element to attach canvas to
   * @param options - Renderer-specific options
   * @returns Promise that resolves when renderer is ready
   */
  init(container: HTMLElement, options: RenderOptions): Promise<RenderResult>

  /**
   * Destroy the renderer and clean up resources
   */
  destroy(): void

  /**
   * Get current viewport position
   * @returns ObservablePoint with x, y coordinates
   */
  getViewportPosition(): { x: number; y: number }

  /**
   * Get current viewport scale
   * @returns Scale factor (1.0 = 100% zoom)
   */
  getViewportScale(): number

  /**
   * Set viewport position
   * @param x - X coordinate
   * @param y - Y coordinate
   */
  setViewportPosition(x: number, y: number): void

  /**
   * Set viewport scale (zoom)
   * @param scale - Scale factor (1.0 = 100% zoom)
   * @param centerX - Center of zoom (client X)
   * @param centerY - Center of zoom (client Y)
   */
  setViewportScale(scale: number, centerX: number, centerY: number): void

  /**
   * Resize the renderer
   * @param width - New width in pixels
   * @param height - New height in pixels
   */
  resize(width: number, height: number): void

  /**
   * Get the canvas element
   */
  getCanvas(): HTMLCanvasElement | null

  /**
   * Get the renderer instance (for direct access if needed)
   */
  getInstance(): unknown
}

/**
 * Standard options for renderer initialization
 */
export interface RenderOptions {
  width: number
  height: number
  backgroundColor?: number
  antialias?: boolean
  resolution?: number
  autoDensity?: boolean
  [key: string]: unknown
}

export interface RenderResult {
  canvas: HTMLCanvasElement | null
  instance: unknown
}
