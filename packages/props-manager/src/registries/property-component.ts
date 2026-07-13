import type {
  PropertyComponentInstanceTypes,
  PropertyComponentRawData
} from '@asyra/utils'
import { MapRegistry } from '@asyra/utils'

type PropertyComponentConstructor = new (
  data: Partial<PropertyComponentRawData>
) => PropertyComponentInstanceTypes

interface RegisterOptions {
  duplicateErrorMessage?: string
}

class PropertyComponentRegistry {
  private registry = new MapRegistry<string, PropertyComponentConstructor>()

  register(
    type: string,
    component: PropertyComponentConstructor,
    options: RegisterOptions = {}
  ): void {
    if (!type) {
      return
    }

    this.registry.register(type, component, {
      duplicateErrorMessage:
        options.duplicateErrorMessage ??
        `Property component "${type}" is already registered`
    })
  }

  get(type: string): PropertyComponentConstructor | undefined {
    return this.registry.get(type)
  }

  has(type: string): boolean {
    return this.registry.has(type)
  }

  unregister(type: string): void {
    this.registry.delete(type)
  }

  clear(): void {
    this.registry.clear()
  }
}

export const propertyComponentRegistry = new PropertyComponentRegistry()

export const registerPropertyComponent = (
  type: string,
  component: PropertyComponentConstructor,
  options?: RegisterOptions
) => propertyComponentRegistry.register(type, component, options)

export const getPropertyComponent = (type: string) =>
  propertyComponentRegistry.get(type)

export type {
  PropertyComponentConstructor,
  RegisterOptions as RegisterPropertyComponentOptions
}
