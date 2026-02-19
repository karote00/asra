import type { RenderLayerRegistration } from './types/render-layer'

class RenderLayerRegistry {
  private layers = new Map<string, RenderLayerRegistration>()

  register(registration: RenderLayerRegistration): void {
    const { name } = registration

    if (this.layers.has(name)) {
      console.warn(`Render layer "${name}" already registered. Overwriting.`)
    }

    this.layers.set(name, registration)
  }

  unregister(name: string): boolean {
    if (!this.layers.has(name)) {
      console.warn(`Render layer "${name}" not found.`)
      return false
    }

    this.layers.delete(name)
    return true
  }

  get(name: string): RenderLayerRegistration | undefined {
    return this.layers.get(name)
  }

  has(name: string): boolean {
    return this.layers.has(name)
  }

  getAll(): RenderLayerRegistration[] {
    return Array.from(this.layers.values()).sort(
      (a, b) => (a.zIndex || 0) - (b.zIndex || 0)
    )
  }

  clear(): void {
    this.layers.clear()
  }
}

export const renderLayerRegistry = new RenderLayerRegistry()
export default renderLayerRegistry
