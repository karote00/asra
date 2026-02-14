import Element from './components/element'
import Group from './components/group'
import type { ElementRawData } from '@asyra/utils'
import { id, loadId, name, loadName } from '@asyra/utils'
import type { PropertyDefinition } from '@asyra/props-manager'
import { createDynamicPropsClass } from './create-dynamic-props'
import Computed from './components/computed'

export function createDynamicComponent(
    type: string,
    idPrefix: string,
    namePrefix: string,
    properties: PropertyDefinition[],
    defaults: Record<string, any>,
    isContainer: boolean = false
) {
    // Create custom Props class for this component
    const DynamicPropsClass = createDynamicPropsClass(properties)
    const BaseClass = (isContainer ? Group : Element) as any

    return class DynamicComponent extends BaseClass {
        constructor(data?: Partial<ElementRawData>) {
            super(data)
        }

        _init(): void {
            super._init() // Initialize base class first (Group sets up children)

            // Override base initialization where needed
            this.data = {
                ...this.data,
                id: '',
                type,
                name: '',
                visible: false,
                lock: true
            } as any
        }

        create(): void {
            super.create() // Initialize base create

            this.data = {
                ...this.data,
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
            super.load(data) // Load base properties (including children for Group)

            // Load id override if needed
            if (data.id) {
                this.data.id = data.id
                loadId(data.id, idPrefix)
            }

            // Load name override
            if (data.name) {
                this.data.name = data.name
                loadName(data.name, namePrefix)
            }

            // Load added custom properties
            const keys = Object.keys(defaults)
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

                this.computed = new Computed(elementId, this.props, properties.map((p) => p.name))
            }
        }
    } as unknown as new (data?: Partial<ElementRawData>) => Element
}
