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

  unregister(type: string): void {
    this.registry.delete(type)
  }

  clear(): void {
    this.registry.clear()
  }
}

export const propertySchemaRegistry = new PropertySchemaRegistry()

export const registerPropertySchema = (
  schema: PropertySchema,
  options?: RegisterOptions
) => propertySchemaRegistry.register(schema, options)

export const getPropertySchema = (type: string) =>
  propertySchemaRegistry.get(type)

export type { RegisterOptions as RegisterPropertySchemaOptions }
