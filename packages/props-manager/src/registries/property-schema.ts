import { MapRegistry } from '@asyra/utils'
import type { PropertySchema } from '@asyra/utils'

interface RegisterOptions {
  duplicateErrorMessage?: string
}

class PropertySchemaRegistry {
  private registry = new MapRegistry<string, PropertySchema>()

  register(schema: PropertySchema, options: RegisterOptions = {}) {
    if (!schema?.type) {
      return
    }

    this.registry.register(schema.type, schema, {
      duplicateErrorMessage:
        options.duplicateErrorMessage ??
        `Property schema "${schema.type}" is already registered`
    })
  }

  get(type: string): PropertySchema | undefined {
    return this.registry.get(type)
  }

  has(type: string): boolean {
    return this.registry.has(type)
  }

  unregister(type: string): boolean {
    return this.registry.delete(type)
  }

  restoreAfterFailedDeclarativeCommit(schema: PropertySchema): void {
    this.registry.set(schema.type, schema)
  }

  clear(): void {
    this.registry.clear()
  }
}

const propertySchemaRegistryOwner = new PropertySchemaRegistry()

export const propertySchemaRegistry = {
  register: propertySchemaRegistryOwner.register.bind(
    propertySchemaRegistryOwner
  ),
  get: propertySchemaRegistryOwner.get.bind(propertySchemaRegistryOwner),
  has: propertySchemaRegistryOwner.has.bind(propertySchemaRegistryOwner),
  unregister: propertySchemaRegistryOwner.unregister.bind(
    propertySchemaRegistryOwner
  ),
  clear: propertySchemaRegistryOwner.clear.bind(propertySchemaRegistryOwner)
}

export const registerPropertySchema = (
  schema: PropertySchema,
  options?: RegisterOptions
) => propertySchemaRegistry.register(schema, options)

export const getPropertySchema = (type: string) =>
  propertySchemaRegistry.get(type)

export const unregisterPropertySchema = (type: string): boolean =>
  propertySchemaRegistry.unregister(type)

export const restorePropertySchemaAfterFailedDeclarativeCommit = (
  schema: PropertySchema
): void =>
  propertySchemaRegistryOwner.restoreAfterFailedDeclarativeCommit(schema)

export type { RegisterOptions as RegisterPropertySchemaOptions }
