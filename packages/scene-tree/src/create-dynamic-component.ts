import Element from './components/element'
import Group from './components/group'
import type { ElementRawData, ElementAttrs, PropsRawData } from '@asyra/utils'
import { id, loadId, name, loadName } from '@asyra/utils'
import type { PropertyDefinition } from '@asyra/props-manager'
import { createDynamicPropsClass } from './create-dynamic-props'
import Computed from './components/computed'

export function createDynamicComponent(
  type: string,
  idPrefix: string,
  namePrefix: string,
  properties: PropertyDefinition[],
  defaults: Record<string, unknown>,
  isContainer = false
) {
  // Create custom Props class for this component
  const DynamicPropsClass = createDynamicPropsClass(properties)
  const BaseClass = (isContainer ? Group : Element) as typeof Element

  return class DynamicComponent extends BaseClass<
    ElementAttrs & Record<string, unknown>
  > {
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
      }
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
      }
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
      const dataObj = data as Record<string, unknown>
      Object.keys(defaults).forEach((key) => {
        const value = dataObj[key]
        if (value !== undefined) {
          this.data[key] = value
        }
      })
    }

    setupProps(propsData?: Partial<PropsRawData>) {
      const elementId = this.get('id')
      if (this.data.type !== 'workspace') {
        if (propsData) {
          this.props = new DynamicPropsClass(elementId, propsData)
        } else {
          this.props = new DynamicPropsClass(elementId)
        }

        this.computed = new Computed(
          elementId,
          this.props,
          properties.map((p) => p.name)
        )
      }
    }
  } as unknown as new (data?: Partial<ElementRawData>) => Element
}
