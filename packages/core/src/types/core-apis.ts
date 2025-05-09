import type { Factory } from '@asra/factory'
import type InputSystem from '@asra/input-system'
import type { Render } from '@asra/render'
import { CreateRectangleData, PositionData } from '@asra/utils'

export interface APIDeps {
  render: Render
}

export interface HandlerDeps {
  inputSystem: InputSystem
  render: Render
  factory: Factory
}

export interface UndoAPIs {
  undo: () => void
  redo: () => void
}

export interface ViewportAPIs {
  getViewportPosition: () => Promise<PositionData>
  getViewportScale: () => Promise<number>
  zoomFit: () => void
  panTo: (x: number, y: number) => void
  zoomToCenter: (scale: number, centerX: number, centerY: number) => void
}

export interface RenderAPIs {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initRender: (width: number, height: number, color: number) => Promise<any>
}

export interface SceneTreeAPIs {
  addRectangle: (data: CreateRectangleData) => void
}

export interface ElementSelectionAPIs {
  selectElements: (elementIds: string[]) => void
}

export type CoreAPIs = UndoAPIs &
  ViewportAPIs &
  RenderAPIs &
  SceneTreeAPIs &
  ElementSelectionAPIs
