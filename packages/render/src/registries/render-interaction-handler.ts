import type {
  RenderInteractionHandlerRegistration,
  RenderInteractionEventType
} from '../types/render-interaction'

type InteractionHandlerMap = Record<string, RenderInteractionHandlerRegistration[]>

class RenderInteractionHandlerRegistry {
  private handlers: InteractionHandlerMap = {}

  register(
    targetId: string | RegExp,
    registration: RenderInteractionHandlerRegistration
  ): void {
    const key = targetId instanceof RegExp ? targetId.source : targetId

    if (!this.handlers[key]) {
      this.handlers[key] = []
    }

    this.handlers[key].push(registration)
  }

  unregister(targetId: string, eventType?: RenderInteractionEventType): void {
    if (!this.handlers[targetId]) {
      return
    }

    if (eventType) {
      const filtered = this.handlers[targetId].filter(
        (h) => h.eventType !== eventType
      )

      if (filtered.length === 0) {
        const { [targetId]: removed, ...rest } = this.handlers
        this.handlers = rest
      } else {
        this.handlers[targetId] = filtered
      }
    } else {
      const { [targetId]: removed, ...rest } = this.handlers
      this.handlers = rest
    }
  }

  get(
    targetId: string,
    eventType: RenderInteractionEventType
  ): RenderInteractionHandlerRegistration[] {
    const directMatch = this.handlers[targetId]
    if (directMatch) {
      const filtered = directMatch.filter((h) => h.eventType === eventType)
      return filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    }

    const results: RenderInteractionHandlerRegistration[] = []

    for (const [pattern, handlers] of Object.entries(this.handlers)) {
      try {
        const regexPattern = pattern.includes('*')
          ? pattern.replace(/\*/g, '.*')
          : pattern
        const regex = new RegExp(regexPattern)

        if (regex.test(targetId)) {
          const matched = handlers.filter((h) => h.eventType === eventType)
          results.push(...matched)
        }
      } catch (e) {
        continue
      }
    }

    return results.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  has(targetId: string): boolean {
    if (this.handlers[targetId]) {
      return true
    }

    for (const pattern of Object.keys(this.handlers)) {
      try {
        const regexPattern = pattern.includes('*')
          ? pattern.replace(/\*/g, '.*')
          : pattern
        const regex = new RegExp(regexPattern)

        if (regex.test(targetId)) {
          return true
        }
      } catch (e) {
        continue
      }
    }

    return false
  }

  clear(): void {
    this.handlers = {}
  }
}

export const renderInteractionHandlerRegistry =
  new RenderInteractionHandlerRegistry()
export default renderInteractionHandlerRegistry
