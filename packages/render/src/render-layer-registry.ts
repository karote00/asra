import { MapRegistry } from '@asyra/utils'
import type { RenderLayerRegistration } from './types/render-layer'

class RenderLayerRegistry {
  private layers = new MapRegistry<string, RenderLayerRegistration>()

  register(
    registration: RenderLayerRegistration,
    _options: { override?: boolean } = {}
  ): void {
    const { name } = registration
    this.layers.register(name, registration, {
      duplicateErrorMessage: `Render layer "${name}" is already registered`
    })
  }

  unregister(name: string): boolean {
    if (!this.layers.has(name)) {
      console.warn(`Render layer "${name}" not found.`)
      return false
    }

    return this.layers.delete(name)
  }

  get(name: string): RenderLayerRegistration | undefined {
    return this.layers.get(name)
  }

  has(name: string): boolean {
    return this.layers.has(name)
  }

  getAll(): RenderLayerRegistration[] {
    return this.layers.values().sort(
      (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
    )
  }

  clear(): void {
    this.layers.clear()
  }
}

export const renderLayerRegistry = new RenderLayerRegistry()
export default renderLayerRegistry
