import { MapRegistry } from '@asyra/utils'
import type { RenderLayerRegistration } from '../types/render-layer'

export class RenderLayerRegistry {
  private layers = new MapRegistry<string, RenderLayerRegistration>()
  private sortedLayers: RenderLayerRegistration[] | null = null

  register(
    registration: RenderLayerRegistration,
    _options: { override?: boolean } = {}
  ): void {
    const { name } = registration
    this.layers.register(name, registration, {
      duplicateErrorMessage: `Render layer "${name}" is already registered`
    })
    this.sortedLayers = null
  }

  unregister(name: string): boolean {
    if (!this.layers.has(name)) {
      console.warn(`Render layer "${name}" not found.`)
      return false
    }

    const didDelete = this.layers.delete(name)
    if (didDelete) {
      this.sortedLayers = null
    }
    return didDelete
  }

  get(name: string): RenderLayerRegistration | undefined {
    return this.layers.get(name)
  }

  has(name: string): boolean {
    return this.layers.has(name)
  }

  getAll(): RenderLayerRegistration[] {
    if (!this.sortedLayers) {
      this.sortedLayers = this.layers
        .values()
        .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
    }
    return this.sortedLayers
  }

  clear(): void {
    this.layers.clear()
    this.sortedLayers = null
  }
}
