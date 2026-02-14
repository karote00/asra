import Element from './components/element'
import type { ElementRawData } from '@asyra/utils'
import { id, loadId, name, loadName } from '@asyra/utils'
import type { PropertyDefinition } from '@asyra/props-manager'
import { createDynamicPropsClass } from './create-dynamic-props'

export function createDynamicComponent(
    type: string,
    idPrefix: string,
    namePrefix: string,
    properties: PropertyDefinition[],
    defaults: Record<string, any>
) {
    // Create custom Props class for this component
    const DynamicPropsClass = createDynamicPropsClass(properties)

    return class DynamicComponent extends Element {
        constructor(data?: Partial<ElementRawData>) {
            super(data)
        }

        _init(): void {
            // Don't call super._init() - we handle everything here
            this.data = {
                id: '',
                type,
                name: '',
                visible: false,
                lock: true
            } as any
        }

        create(): void {
            this.data = {
                id: id(idPrefix),
                type,
                name: name(namePrefix),
                visible: true,
                lock: false,
                ...defaults
            } as any
        }

        load(data: Partial<ElementRawData>): void {
            if (!data) return

            // Load id
            if (data.id) {
                this.data.id = data.id
                loadId(data.id, idPrefix)
            }

            // Load name
            if (data.name) {
                this.data.name = data.name
                loadName(data.name, namePrefix)
            }

            // Load other properties
            const keys = ['visible', 'lock', ...Object.keys(defaults)]
            keys.forEach((key) => {
                const value = (data as any)[key]
                if (value !== undefined) {
                    (this.data as any)[key] = value
                }
            })
        }

        setupProps(propsData?: any) {
            const elementId = this.get('id') as string
            if (this.data.type !== 'workspace') {
                if (propsData) {
                    this.props = new DynamicPropsClass(elementId, propsData) as any
                } else {
                    this.props = new DynamicPropsClass(elementId) as any
                }

                // Setup computed (reuse existing Computed class)
                const Computed = require('./components/computed').default
                this.computed = new Computed(elementId, this.props)
            }
        }
    }
}
