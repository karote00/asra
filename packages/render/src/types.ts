import { ComputedAttrs, ElementRawData } from '@asyra/utils'
import type { RenderContainer, RenderGraphics } from './types/render-object'

export type RenderElementData = Omit<ElementRawData, 'props'> & ComputedAttrs

export type RenderElementsData = Record<string, RenderElementData>

export interface RenderContainerData {
  label: string
  x: number
  y: number
}

// The type of elements that can be selected
export type SceneElement = RenderContainer | RenderGraphics
