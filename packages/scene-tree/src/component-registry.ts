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
    this.registry.set(registration.type, registration, {
      onDuplicate: () => {
        console.warn(
          `Component "${registration.type}" already registered. Overwriting.`
        )
      }
    })
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
