import { InputEventCombo } from './event-mappings'

export class InputSystemRegistry {
  private mappings: Map<string, InputEventCombo[]> = new Map()

  /**
   * Register input event combinations for a given event name
   * @param eventName - The event name to trigger
   * @param combos - Array of input combinations that trigger this event
   */
  register(eventName: string, combos: InputEventCombo[]): void {
    this.mappings.set(eventName, combos)
  }

  /**
   * Get all registered event names
   */
  getEventNames(): string[] {
    return Array.from(this.mappings.keys())
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
