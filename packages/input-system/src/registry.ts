import { MapRegistry } from '@asyra/utils'
import { InputEventCombo } from './event-mappings.js'

export class InputSystemRegistry {
  private mappings = new MapRegistry<string, InputEventCombo[]>()

  /**
   * Register input event combinations for a given event name
   * @param eventName - The event name to trigger
   * @param combos - Array of input combinations that trigger this event
   */
  register(eventName: string, combos: InputEventCombo[]): void {
    this.mappings.register(eventName, combos, {
      duplicateErrorMessage: `Input event "${eventName}" is already registered`
    })
  }

  /**
   * Register multiple events from a config object
   * @param combinations - Config object with event names as keys
   */
  registerKeyCombinations(
    combinations: Record<string, InputEventCombo[]>
  ): void {
    for (const [eventName, combos] of Object.entries(combinations)) {
      this.register(eventName, combos)
    }
  }

  /**
   * Get all registered event names
   */
  getEventNames(): string[] {
    return this.mappings.keys()
  }

  /**
   * Get combinations for a specific event
   * @param eventName - The event name
   * @returns Array of input combinations, or undefined if not found
   */
  getCombinations(eventName: string): InputEventCombo[] | undefined {
    return this.mappings.get(eventName)
  }

  /**
   * Check if an event is registered
   * @param eventName - The event name to check
   */
  hasEvent(eventName: string): boolean {
    return this.mappings.has(eventName)
  }

  /**
   * Remove an event registration
   * @param eventName - The event name to remove
   */
  unregister(eventName: string): void {
    this.mappings.delete(eventName)
  }

  /**
   * Clear all registered events
   */
  clear(): void {
    this.mappings.clear()
  }
}
