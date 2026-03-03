import type { InteractionRegistration } from '../types/interaction-handler'

type InteractionHandlerMap = Record<string, InteractionRegistration[]>

class InteractionHandlerRegistry {
  private handlers: InteractionHandlerMap = {}

  register(
    elementId: string | RegExp,
    registration: InteractionRegistration
  ): void {
    const key = elementId instanceof RegExp ? elementId.source : elementId

    if (!this.handlers[key]) {
      this.handlers[key] = []
    }

    this.handlers[key].push(registration)
  }

  unregister(elementId: string, eventType?: string): void {
    if (!this.handlers[elementId]) {
      return
    }

    if (eventType) {
      const filtered = this.handlers[elementId].filter(
        (h) => h.eventType !== eventType
      )

      if (filtered.length === 0) {
        const { [elementId]: removed, ...rest } = this.handlers
        this.handlers = rest
      } else {
        this.handlers[elementId] = filtered
      }
    } else {
      const { [elementId]: removed, ...rest } = this.handlers
      this.handlers = rest
    }
  }

  get(elementId: string, eventType: string): InteractionRegistration[] {
    const directMatch = this.handlers[elementId]
    if (directMatch) {
      const filtered = directMatch.filter((h) => h.eventType === eventType)
      return filtered.sort((a, b) => (b.priority || 0) - (a.priority || 0))
    }

    const results: InteractionRegistration[] = []

    for (const [pattern, handlers] of Object.entries(this.handlers)) {
      try {
        const regexPattern = pattern.includes('*')
          ? pattern.replace(/\*/g, '.*')
          : pattern
        const regex = new RegExp(regexPattern)

        if (regex.test(elementId)) {
          const matched = handlers.filter((h) => h.eventType === eventType)
          results.push(...matched)
        }
      } catch (e) {
        // Invalid regex pattern, skip
        continue
      }
    }

    return results.sort((a, b) => (b.priority || 0) - (a.priority || 0))
  }

  has(elementId: string): boolean {
    if (this.handlers[elementId]) {
      return true
    }

    for (const pattern of Object.keys(this.handlers)) {
      try {
        const regexPattern = pattern.includes('*')
          ? pattern.replace(/\*/g, '.*')
          : pattern
        const regex = new RegExp(regexPattern)

        if (regex.test(elementId)) {
          return true
        }
      } catch (e) {
        // Invalid regex pattern, skip
        continue
      }
    }

    return false
  }

  clear(): void {
    this.handlers = {}
  }
}

export const interactionHandlerRegistry = new InteractionHandlerRegistry()
export default interactionHandlerRegistry
