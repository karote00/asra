import type { RenderStrategy } from './types/render-strategy'

class RenderRegistry {
    private strategies = new Map<string, RenderStrategy>()

    register(type: string, strategy: RenderStrategy): void {
        if (this.strategies.has(type)) {
            console.warn(
                `Render strategy for "${type}" already registered. Overwriting.`
            )
        }
        this.strategies.set(type, strategy)
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
