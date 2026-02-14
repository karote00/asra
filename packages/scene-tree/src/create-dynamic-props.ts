import type {
    PropertyComponentInstanceDataTypes,
    PropsRawData
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
        elementId: string
        [key: string]: any // Dynamic property IDs

        constructor(elementId: string, data?: Partial<PropsRawData>) {
            this.elementId = elementId

            if (data) {
                this.load(data)
            } else {
                this.init()
            }
        }

        init() {
            // Create property components for each property
            const propertyComponents = properties.map((prop) =>
                propsManager.createProperty({ type: prop.type })
            )

            const propIdsMap = propsManager.addProperty(propertyComponents)
            propsManager.commitChanges()

            if (!propIdsMap) {
                return
            }

            // Store property component IDs by property name
            properties.forEach((prop) => {
                this[prop.name] = propIdsMap[prop.type]
            })
        }

        load(data: Partial<PropsRawData> = {}): void {
            const propertyComponents = properties.map((prop) => {
                const propId = (data as any)[prop.type]
                const propComponent = propId
                    ? propsManager.getComponentById(propId)
                    : null

                if (propComponent) {
                    return propComponent
                } else {
                    return propsManager.createProperty({ type: prop.type })
                }
            })

            const propIdsMap = propsManager.addProperty(propertyComponents)
            if (!propIdsMap) {
                return
            }

            properties.forEach((prop) => {
                this[prop.name] = propIdsMap[prop.type]
            })
        }

        save(): PropsRawData {
            return properties.reduce((acc, prop) => {
                (acc as any)[prop.type] = this[prop.name] as string
                return acc
            }, {} as PropsRawData)
        }

        updateData<K extends keyof PropertyComponentInstanceDataTypes>(
            key: K,
            data: PropertyComponentInstanceDataTypes[K]
        ) {
            // Resolve alias to property name
            const propName =
                aliasToProperty.get(key as string) || (key as string)
            const propComponentId = this[propName]

            if (!propComponentId) {
                return
            }

            // Update the property component data
            propsManager.updatePropsData(propComponentId, key, data)
        }

        cleanup() {
            const removedPropertyIds = properties.map((prop) => ({
                id: this[prop.name]
            }))
            removeProperty(removedPropertyIds)
        }
    }
}
