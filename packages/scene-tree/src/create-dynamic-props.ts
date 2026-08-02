import type {
  EvnetOptions,
  PropertyComponentInstanceTypes,
  PropertyComponentInstanceDataTypes,
  PropsRawData,
  IProps
} from '@asyra/utils'
import propsManager, {
  type PropertyDefinition,
  type PropsManager
} from '@asyra/props-manager'

export function createDynamicPropsClass(properties: PropertyDefinition[]) {
  // Build maps for efficient lookup
  const propNameToType = new Map<string, string>()
  const aliasToProperty = new Map<string, string>()

  properties.forEach((prop) => {
    propNameToType.set(prop.name, prop.type)

    if (prop.alias) {
      prop.alias.forEach((alias) => {
        aliasToProperty.set(alias, prop.name)
      })
    }
  })

  return class DynamicProps {
    elementId: string;
    [key: string]: unknown // Generic index for class methods and properties

    constructor(
      elementId: string,
      data?: Partial<PropsRawData>,
      private readonly propsManagerOwner: PropsManager = propsManager
    ) {
      this.elementId = elementId

      if (data) {
        this.load(data)
      } else {
        this.init()
      }
    }

    getPropId(name: string): string | undefined {
      const val = this[name]
      return typeof val === 'string' ? val : undefined
    }

    getCanonicalRootPropertyIds(): readonly string[] {
      return properties.flatMap((property) => {
        const propertyId = this.getPropId(property.name)
        return propertyId ? [propertyId] : []
      })
    }

    private createProperty(prop: PropertyDefinition, id?: string) {
      return this.propsManagerOwner.createProperty({
        ...(id ? { id } : {}),
        type: prop.type,
        ...(prop.defaultValue === undefined
          ? {}
          : { [prop.name]: prop.defaultValue })
      })
    }

    init() {
      const components = properties.map((property) =>
        this.createProperty(property)
      )
      this.propsManagerOwner.addProperty(components)
      properties.forEach((prop, index) => {
        const component = components[index]
        this[prop.name] = component.get('id')
      })
    }

    load(data: Partial<PropsRawData> = {}): void {
      const dataObj = data as Record<string, string | undefined>
      const createdComponents: PropertyComponentInstanceTypes[] = []
      const components = properties.map((prop) => {
        const propId = dataObj[prop.name]
        const propComponent = propId
          ? this.propsManagerOwner.getPropertyById(propId)
          : null

        if (propComponent) {
          return propComponent
        }
        const created = this.createProperty(prop, propId)
        createdComponents.push(created)
        return created
      })
      if (createdComponents.length > 0) {
        this.propsManagerOwner.addProperty(createdComponents)
      }
      properties.forEach((prop, index) => {
        this[prop.name] = components[index].get('id')
      })
    }

    save(): PropsRawData {
      const data = {} as PropsRawData
      properties.forEach((prop) => {
        const id = this.getPropId(prop.name)
        if (id) {
          data[prop.name] = id
        }
      })
      return data
    }

    updateData<K extends keyof PropertyComponentInstanceDataTypes>(
      key: K,
      data: PropertyComponentInstanceDataTypes[K],
      options?: EvnetOptions
    ) {
      // Resolve alias to property name
      const propName = aliasToProperty.get(key as string) || (key as string)
      const propId = this.getPropId(propName)

      if (!propId) {
        return
      }

      // Update the property component data
      this.propsManagerOwner.updatePropsData(propId, key, data, options)
    }

    cleanup(options?: EvnetOptions) {
      properties.forEach((prop) => {
        const propId = this.getPropId(prop.name)
        if (propId) {
          this.propsManagerOwner.removeProperty([propId], options)
        }
      })
    }
  } as unknown as new (
    elementId: string,
    data?: Partial<PropsRawData>,
    propsManager?: PropsManager
  ) => IProps
}
