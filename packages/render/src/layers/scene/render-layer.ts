import {
  SceneElement,
  RenderContainerData,
  RenderElementData
} from '../../types'
import { DataTypes, getElementGeometryLocalBounds } from '@asyra/utils'
import renderStrategyRegistry from '../../registries/render-strategy'
import { defaultStrategy } from '../../strategies/default-strategy'
import { RenderContainer, RenderGraphics } from '../../types/render-object'

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const measureBrowserDragPhase = <T>(phaseName: string, run: () => T): T => {
  const sink = (
    globalThis as typeof globalThis & {
      __asyraBrowserDragPhaseSink?: (
        phaseName: string,
        durationMs: number
      ) => void
    }
  ).__asyraBrowserDragPhaseSink
  if (!sink) {
    return run()
  }

  const start = performance.now()
  try {
    return run()
  } finally {
    sink(phaseName, performance.now() - start)
  }
}

export class RenderLayer {
  private currentWorkspace: RenderContainer
  private _elements: Map<string, SceneElement> = new Map()

  constructor() {
    this.currentWorkspace = new RenderContainer()
  }

  get view() {
    return this.currentWorkspace
  }

  addToMap(elementId: string, instance: SceneElement) {
    this._elements.set(elementId, instance)
    instance.eventMode = 'static'
    instance.cursor = 'pointer'
  }

  removeFromMap(elementId: string) {
    const instance = this.getElementById(elementId)
    if (!instance) {
      return undefined
    }
    instance.eventMode = 'none'
    instance.removeAllListeners()
    ;[...instance.children].forEach((child) => {
      instance.removeChild(child)
    })
    instance.parent?.removeChild(instance)
    instance.destroy({ children: false })
    this._elements.delete(elementId)
    return instance
  }

  getAllElements() {
    return this._elements
  }

  clearElements() {
    this._elements.forEach((element) => {
      element.eventMode = 'none'
      element.removeAllListeners()
      if (element.parent) {
        element.parent.removeChild(element)
      }
      element.destroy({ children: true })
    })
    this._elements.clear()
    this.currentWorkspace.removeChildren()
    this.currentWorkspace.label = ''
    this.currentWorkspace.x = 0
    this.currentWorkspace.y = 0
  }

  getElementById(elementId: string): SceneElement | undefined {
    return this._elements.get(elementId)
  }

  switchWorkspace(workspaceData: RenderContainerData) {
    this.currentWorkspace.label = workspaceData.label
    this.currentWorkspace.x = workspaceData.x
    this.currentWorkspace.y = workspaceData.y
  }

  private renderGraphic(graphic: RenderGraphics, data: RenderElementData) {
    ;(
      graphic as RenderGraphics & {
        __asyraLastRenderDataSnapshot?: RenderElementData
      }
    ).__asyraLastRenderDataSnapshot = data
    const strategy = renderStrategyRegistry.get(data.type) || defaultStrategy
    try {
      measureBrowserDragPhase(`render-layer:strategy:${data.type}`, () =>
        strategy(graphic, data)
      )
      graphic.visible = data.visible !== false
      return true
    } catch (error) {
      console.error('[RenderLayer] Element render strategy failed', {
        elementId: data.id,
        type: data.type,
        error
      })
      graphic.clear()
      graphic.visible = false
      return false
    }
  }

  private placeElement(element: SceneElement, data: RenderElementData) {
    const parent =
      typeof data.parentId === 'string'
        ? this.getElementById(data.parentId)
        : undefined
    ;(parent ?? this.currentWorkspace).addChild(element)

    const children = (data as RenderElementData & { children?: unknown })
      .children
    if (!Array.isArray(children)) {
      return
    }
    children.forEach((childId: unknown, index: number) => {
      if (typeof childId !== 'string') {
        return
      }
      const child = this.getElementById(childId)
      if (child) {
        element.addChildAt(child, index)
      }
    })
  }

  addContainer(containerData: RenderContainerData) {
    const container = new RenderContainer({
      label: containerData.label,
      x: containerData.x,
      y: containerData.y
    })
    this._elements.set(containerData.label, container)
    this.currentWorkspace.addChild(container)

    return container
  }

  addElement(data: RenderElementData) {
    if (!data || typeof data.id !== 'string' || typeof data.type !== 'string') {
      return undefined
    }

    return measureBrowserDragPhase('render-layer:add-or-update-element', () => {
      const existingElement = this.getElementById(data.id)
      if (existingElement) {
        ;(
          existingElement as SceneElement & { __asyraType?: string }
        ).__asyraType = data.type

        const didRender =
          existingElement instanceof RenderGraphics
            ? this.renderGraphic(existingElement, data)
            : true

        this.placeElement(existingElement, data)

        return didRender ? existingElement : undefined
      }

      const graphic = new RenderGraphics()
      graphic.label = data.id
      ;(graphic as SceneElement & { __asyraType?: string }).__asyraType =
        data.type

      const didRender = this.renderGraphic(graphic, data)

      this.addToMap(data.id, graphic)
      this.placeElement(graphic, data)
      return didRender ? graphic : undefined
    })
  }

  removeElement(elementId: string, _parentId?: string) {
    const element = this.getElementById(elementId)

    if (element) {
      this.removeFromMap(elementId)
    }

    return element
  }

  updateElement(
    elementId: string,
    key: string,
    before: DataTypes,
    after: DataTypes,
    data?: RenderElementData
  ) {
    const element = this.getElementById(elementId)
    if (!element) {
      return
    }

    // Handle children separately as it requires structural changes
    if (key === 'children') {
      const previousChildren = Array.isArray(before) ? before : []
      const nextChildren = Array.isArray(after) ? after : []
      const oldList = new Set(previousChildren as string[])
      const deleteCount = 0
      // Add element
      nextChildren.forEach((childId, index) => {
        if (typeof childId !== 'string') {
          return
        }
        const child = this.getElementById(childId)
        if (!child) {
          return
        }

        if (oldList.has(childId)) {
          oldList.delete(childId)
        } else {
          element.addChildAt(child, index - deleteCount)
        }
      })

      // Remove element
      oldList.forEach((childId) => {
        const child = this.getElementById(childId)
        if (!child) {
          return
        }

        element.removeChild(child)
      })

      // Move element
      element.children.forEach((child, index) => {
        const newIndex = nextChildren.indexOf(child.label)
        if (newIndex !== index && newIndex !== -1) {
          element.setChildIndex(child, newIndex)
        }
      })
      return
    }

    // For other properties, use strategy if available and it's a Graphics object
    const strategy = data
      ? renderStrategyRegistry.get(data.type) || defaultStrategy
      : null
    if (strategy && element instanceof RenderGraphics && data) {
      this.renderGraphic(element, data)
    } else {
      this.updateElementProperties(element, key, after)
    }
  }

  updateElementProperties(
    element: RenderContainer | RenderGraphics,
    key: string,
    after: DataTypes
  ) {
    measureBrowserDragPhase('render-layer:update-property', () => {
      switch (key) {
        case 'x':
          if (isFiniteNumber(after)) {
            element.x = after
          }
          break
        case 'y':
          if (isFiniteNumber(after)) {
            element.y = after
          }
          break
        case 'width':
          if (isFiniteNumber(after) && after >= 0) {
            element.width = after
          }
          break
        case 'height':
          if (isFiniteNumber(after) && after >= 0) {
            element.height = after
          }
          break
        case 'visible':
          element.visible = Boolean(after)
          break
        case 'rotation':
          if (isFiniteNumber(after)) {
            element.rotation = after
          }
          break
      }
    })
  }

  /**
   * Calculates the combined bounding box of all visible elements in the workspace,
   * expressed in the local coordinate space of the workspace (i.e., ignoring zoom and pan).
   *
   * This method ensures consistent bounding box results regardless of the current
   * zoom or pan applied to the workspace.
   *
   * @param workspace - The container holding all elements (typically zoomed/panned).
   * @returns A bounding box object containing { minX, minY, maxX, maxY } in local space.
   */
  getAllElementsBounds(workspace: RenderContainer) {
    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity
    }

    for (const [, element] of this._elements) {
      if (element instanceof RenderGraphics && element.visible) {
        // Prefer authored geometry bounds so vector layout does not expand with stroke rendering.
        const localBounds = getElementGeometryLocalBounds(element)

        // Convert each corner to workspace local space and update bounding box
        const corners = [
          { x: localBounds.x, y: localBounds.y },
          { x: localBounds.x + localBounds.width, y: localBounds.y },
          { x: localBounds.x, y: localBounds.y + localBounds.height },
          {
            x: localBounds.x + localBounds.width,
            y: localBounds.y + localBounds.height
          }
        ]
        for (const corner of corners) {
          const localCorner = workspace.toLocal(element.toGlobal(corner))
          bounds.minX = Math.min(bounds.minX, localCorner.x)
          bounds.minY = Math.min(bounds.minY, localCorner.y)
          bounds.maxX = Math.max(bounds.maxX, localCorner.x)
          bounds.maxY = Math.max(bounds.maxY, localCorner.y)
        }
      }
    }

    return bounds
  }
}
