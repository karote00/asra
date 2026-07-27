import { MapRegistry } from '@asyra/utils'
import type { PropertySchema } from '@asyra/utils'
import type { PropertyRegistrationOptions } from './registration-options'

type PropertySchemaResolver = (type: string) => PropertySchema | undefined

let scopedPropertySchemaResolver: PropertySchemaResolver | undefined

class PropertySchemaRegistry {
  private registry = new MapRegistry<string, PropertySchema>()
  private registrationRevisions = new Map<string, number>()

  private bumpRegistrationRevision(type: string): void {
    this.registrationRevisions.set(
      type,
      (this.registrationRevisions.get(type) ?? 0) + 1
    )
  }

  register(schema: PropertySchema, options: PropertyRegistrationOptions = {}) {
    if (!schema?.type) {
      return
    }

    this.registry.register(schema.type, schema, {
      duplicateErrorMessage:
        options.duplicateErrorMessage ??
        `Property schema "${schema.type}" is already registered`
    })
    this.bumpRegistrationRevision(schema.type)
  }

  get(type: string): PropertySchema | undefined {
    return this.registry.get(type)
  }

  has(type: string): boolean {
    return this.registry.has(type)
  }

  getRegistrationRevision(type: string): number {
    return this.registrationRevisions.get(type) ?? 0
  }

  unregister(type: string): boolean {
    const removed = this.registry.delete(type)
    if (removed) {
      this.bumpRegistrationRevision(type)
    }
    return removed
  }

  restoreAfterFailedDeclarativeCommit(schema: PropertySchema): void {
    this.registry.set(schema.type, schema)
    this.bumpRegistrationRevision(schema.type)
  }

  clear(): void {
    const clearedTypes = this.registry.keys()
    this.registry.clear()
    clearedTypes.forEach((type) => {
      this.bumpRegistrationRevision(type)
    })
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
  options?: PropertyRegistrationOptions
) => propertySchemaRegistry.register(schema, options)

export const getRegisteredPropertySchema = (type: string) =>
  propertySchemaRegistry.get(type)

export const getPropertySchema = (type: string) =>
  scopedPropertySchemaResolver
    ? scopedPropertySchemaResolver(type)
    : getRegisteredPropertySchema(type)

export const runWithPropertySchemaResolver = <T>(
  resolver: PropertySchemaResolver,
  callback: () => T
): T => {
  const previousResolver = scopedPropertySchemaResolver
  scopedPropertySchemaResolver = resolver
  try {
    return callback()
  } finally {
    scopedPropertySchemaResolver = previousResolver
  }
}

export const getPropertySchemaRegistrationRevision = (type: string) =>
  propertySchemaRegistryOwner.getRegistrationRevision(type)

export const unregisterPropertySchema = (type: string): boolean =>
  propertySchemaRegistry.unregister(type)

export const restorePropertySchemaAfterFailedDeclarativeCommit = (
  schema: PropertySchema
): void =>
  propertySchemaRegistryOwner.restoreAfterFailedDeclarativeCommit(schema)
