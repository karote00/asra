import { EntityTypes } from './enum'
import { ElementRawData } from './rawDataTypes'

export type ElementAttrs = {
  id: string
  type: EntityTypes
  name: string
}

export type GroupAttrs<T = any> = ElementAttrs & {
  children: T[]
}

export interface IElement<T extends ElementAttrs = ElementAttrs> {
  load(data: ElementRawData): void
  save(): ElementRawData
  get<K extends keyof T>(key: K): T[K]
}

export type GroupInstanceTypes = IElement<GroupAttrs<ElementInstanceTypes>> & {
  addElement(element: ElementInstanceTypes, index?: number): boolean
}
export type ElementInstanceTypes = IElement<ElementAttrs> | GroupInstanceTypes
