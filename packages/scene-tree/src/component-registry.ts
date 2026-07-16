import { MapRegistry } from '@asyra/utils'
import type { ElementRawData } from '@asyra/utils'
import type Element from './components/element'
import type { PropertyDefinition } from '@asyra/props-manager'

interface ComponentRegistration {
  type: string
  idPrefix: string
  namePrefix: string
  constructor: new (data?: Partial<ElementRawData>) => Element
  properties: PropertyDefinition[]
  defaults: Record<string, unknown>
  isContainer?: boolean
}

class ComponentRegistry {
  private registry = new MapRegistry<string, ComponentRegistration>()

  register(registration: ComponentRegistration): void {
    this.registry.register(registration.type, registration, {
      duplicateErrorMessage: `Component "${registration.type}" is already registered`
    })
  }

  rebuild(registration: ComponentRegistration): void {
    if (!this.registry.has(registration.type)) {
      throw new Error(`Component "${registration.type}" is not registered`)
    }
    this.registry.set(registration.type, registration)
  }

  unregister(type: string): boolean {
    return this.registry.delete(type)
  }

  get(type: string): ComponentRegistration | undefined {
    return this.registry.get(type)
  }

  has(type: string): boolean {
    return this.registry.has(type)
  }

  getAll(): Map<string, ComponentRegistration> {
    return this.registry.cloneMap()
  }
}

export const componentRegistry = new ComponentRegistry()
export default componentRegistry
export type { ComponentRegistration }
