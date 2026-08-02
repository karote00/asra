import { MapRegistry } from '@asyra/utils'
import type { RenderStrategy } from '../types/render-strategy'

class RenderStrategyRegistry {
  private strategies = new MapRegistry<string, RenderStrategy>()

  register(type: string, strategy: RenderStrategy): void {
    this.strategies.register(type, strategy, {
      duplicateErrorMessage: `Render strategy for "${type}" is already registered`
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

  supportsDirectProperty(type: string, key: string): boolean {
    return (
      this.strategies
        .get(type)
        ?.directPropertyKeys?.some((propertyKey) => propertyKey === key) ===
      true
    )
  }
}

export const renderStrategyRegistry = new RenderStrategyRegistry()
export default renderStrategyRegistry
