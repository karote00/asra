import type {
  PropertyComponentInstanceDataTypes,
  PropsRawData,
  IProps
} from '@asyra/utils'
import { removeProperty } from '@asyra/reactive-events'
import propsManager from '@asyra/props-manager'
import type { PropertyDefinition } from '@asyra/props-manager'

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

    constructor(elementId: string, data?: Partial<PropsRawData>) {
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

    init() {
      // Create property components for each property and store by name
      properties.forEach((prop) => {
        const component = propsManager.createProperty({ type: prop.type })
        propsManager.addToMap(component)
        this[prop.name] = component.get('id')
      })
      propsManager.commitChanges()
    }

    load(data: Partial<PropsRawData> = {}): void {
      const dataObj = data as Record<string, string | undefined>
      properties.forEach((prop) => {
        const propId = dataObj[prop.name]
        const propComponent = propId
          ? propsManager.getComponentById(propId)
          : null

        if (propComponent) {
          this[prop.name] = propId
          propsManager.addToMap(propComponent)
        } else {
          const component = propsManager.createProperty({ type: prop.type })
          propsManager.addToMap(component)
          this[prop.name] = component.get('id')
        }
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
      data: PropertyComponentInstanceDataTypes[K]
    ) {
      // Resolve alias to property name
      const propName = aliasToProperty.get(key as string) || (key as string)
      const propId = this.getPropId(propName)

      if (!propId) {
        return
      }

      // Update the property component data
      propsManager.updatePropsData(propId, key, data)
    }

    cleanup() {
      const removedPropertyIds = properties.reduce<{ id: string }[]>(
        (acc, prop) => {
          const id = this.getPropId(prop.name)
          if (id) {
            acc.push({ id })
          }
          return acc
        },
        []
      )
      removeProperty(removedPropertyIds)
    }
  } as unknown as new (
    elementId: string,
    data?: Partial<PropsRawData>
  ) => IProps
}
