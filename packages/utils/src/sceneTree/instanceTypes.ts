import { ISetter } from '../setter'
import { EntityTypes } from './enum'
import type { ElementRawData } from './rawDataTypes'

export interface ComputedAttrs {
  id: string
  type: EntityTypes
  name: string
  x: number
  y: number
  width: number
  height: number
}

export interface ElementAttrs {
  id: string
  type: EntityTypes
  name: string
  visible: boolean
  lock: boolean
}

export interface GroupAttrs extends ElementAttrs {
  children: string[]
}

export interface IComputed<T extends ComputedAttrs> extends ISetter<T> {}

export interface IElement<T extends ElementAttrs = ElementAttrs>
  extends ISetter<T> {
  load(data: Partial<ElementRawData>): void
  save(): ElementRawData
  cleanup(): void
}

export interface IGroupElement<T extends GroupAttrs = GroupAttrs>
  extends IElement<T> {
  addElement(element: ElementInstanceTypes, index?: number): void
  removeElement(element: ElementInstanceTypes, index: number): void
}

export interface ElementInstanceTypes extends IElement {}
export interface GroupInstanceTypes extends IGroupElement {}
export type ElementInstanceDataTypes = ComputedAttrs | GroupAttrs | ElementAttrs
