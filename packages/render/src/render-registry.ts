import { MapRegistry } from '@asyra/utils'
import type { RenderStrategy } from './types/render-strategy'

class RenderRegistry {
  private strategies = new MapRegistry<string, RenderStrategy>()

  register(type: string, strategy: RenderStrategy): void {
    this.strategies.set(type, strategy, {
      onDuplicate: () => {
        console.warn(
          `Render strategy for "${type}" already registered. Overwriting.`
        )
      }
    })
  }

  unregister(type: string): boolean {
    return this.strategies.delete(type)
  }

  get(type: string): RenderStrategy | undefined {
    return this.strategies.get(type)
  }

  has(type: string): boolean {
    return this.strategies.has(type)
  }
}

export const renderRegistry = new RenderRegistry()
export default renderRegistry
