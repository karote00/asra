import { MapRegistry } from '@asyra/utils'
import type { PropertySchema } from '@asyra/utils'

interface RegisterOptions {
  override?: boolean
}

class PropertySchemaRegistry {
  private registry = new MapRegistry<string, PropertySchema>()

  register(schema: PropertySchema, options: RegisterOptions = {}) {
    if (!schema?.type) {
      return
    }

    this.registry.set(schema.type, schema, {
      override: options.override === true
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
