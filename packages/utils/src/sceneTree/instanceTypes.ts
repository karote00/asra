import { EntityTypes } from './enum'
import type { ElementRawData } from './rawDataTypes'

export interface ElementAttrs {
  id: string
  type: EntityTypes
  name: string
  visible: boolean
  lock: boolean
}

export interface GroupAttrs<
  T extends ElementInstanceTypes = ElementInstanceTypes
> extends ElementAttrs {
  children: T[]
}

export interface IElement<T extends ElementAttrs = ElementAttrs> {
  load(data: Partial<ElementRawData>): void
  save(): ElementRawData
  get<K extends keyof T>(key: K): T[K]
}

export interface IGroupElement
  extends IElement<GroupAttrs<ElementInstanceTypes>> {
  addElement(element: ElementInstanceTypes, index?: number): boolean
  removeElement(element: ElementInstanceTypes, index: number): boolean
}

export interface ElementInstanceTypes extends IElement<ElementAttrs> {}
export interface GroupInstanceTypes extends IGroupElement {}
