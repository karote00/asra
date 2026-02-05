import { defineFeature } from '@asyra/feature-system'
import { EntityTypes, DEFAULT_ELEMENT_SIZE } from '@asyra/utils'
import {
  changeComputedData,
  selectElements,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'
import { render, sceneTree } from '../../contexts'
import { InputSystemEvents, PrimaryToolType } from '../../constants'

let createdElementId: string | null = null
let dragStartWorkspacePos: { x: number; y: number } | null = null

export const createElementFeature = defineFeature('createElement', undefined, {
  name: 'createElement',
  api: {
    createRectangle: (position: { x: number; y: number }) => {
      const pos = render!.getMousePosInWorkspace({
        clientX: position.x,
        clientY: position.y
      })

      const createdElementId = sceneTree.addNewElement({
        type: EntityTypes.RECTANGLE,
        x: pos.x,
        y: pos.y
      })

      return createdElementId
    },
    updateElementSizeAndPosition: (
      elementId: string,
      dragStart: { x: number; y: number },
      currentPos: { x: number; y: number }
    ) => {
      let width = currentPos.x - dragStart.x
      let height = currentPos.y - dragStart.y
      let x = dragStart.x
      let y = dragStart.y

      if (width < 0) {
        width = Math.abs(width)
        x = currentPos.x
      }

      if (height < 0) {
        height = Math.abs(height)
        y = currentPos.y
      }

      changeComputedData([elementId], 'x', x)
      changeComputedData([elementId], 'y', y)
      changeComputedData([elementId], 'width', width)
      changeComputedData([elementId], 'height', height)
    },
    resetElementSize: (elementId: string) => {
      changeComputedData([elementId], 'width', DEFAULT_ELEMENT_SIZE)
      changeComputedData([elementId], 'height', DEFAULT_ELEMENT_SIZE)
    },
    hasMoved: (
      dragStart: { x: number; y: number },
      currentPos: { x: number; y: number }
    ) => {
      return (
        Math.abs(currentPos.x - dragStart.x) > 1 ||
        Math.abs(currentPos.y - dragStart.y) > 1
      )
    },
    hasMovedWithViewport: (
      clientDragStart: { x: number; y: number },
      clientCurrentPos: { x: number; y: number }
    ) => {
      const dragStartWorkspace = render!.getMousePosInWorkspace({
        clientX: clientDragStart.x,
        clientY: clientDragStart.y
      })
      const currentWorkspace = render!.getMousePosInWorkspace({
        clientX: clientCurrentPos.x,
        clientY: clientCurrentPos.y
      })
      return (
        Math.abs(currentWorkspace.x - dragStartWorkspace.x) > 1 ||
        Math.abs(currentWorkspace.y - dragStartWorkspace.y) > 1
      )
    }
  },
  define: ({
    handle
  }: {
    handle: (event: string, callback: (snapshot: any) => any) => void
  }) => {
    handle(InputSystemEvents.INPUT_DRAG_START, (snapshot: any) => {
      const { primaryTool, mouse } = snapshot

      if (primaryTool === PrimaryToolType.RECTANGLE && mouse.down) {
        if (!render) {
          return null
        }

        const dragStart = mouse.dragStart || mouse.position
        const dragStartWorkspace = render!.getMousePosInWorkspace({
          clientX: dragStart.x,
          clientY: dragStart.y
        })

        startTransaction()
        const api = createElementFeature.api as any
        createdElementId = api.createRectangle(dragStart)
        dragStartWorkspacePos = dragStartWorkspace

        if (createdElementId) {
          selectElements([createdElementId])
        }

        endTransaction()
      }

      return null
    })

    handle(InputSystemEvents.INPUT_DRAG_UPDATE, (snapshot: any) => {
      const { primaryTool, mouse } = snapshot

      if (
        primaryTool === PrimaryToolType.RECTANGLE &&
        mouse.dragging &&
        createdElementId &&
        dragStartWorkspacePos
      ) {
        const currentWorkspacePos = render!.getMousePosInWorkspace({
          clientX: mouse.position.x,
          clientY: mouse.position.y
        })

        startTransaction()
        const api = createElementFeature.api as any
        api.updateElementSizeAndPosition(
          createdElementId,
          dragStartWorkspacePos,
          currentWorkspacePos
        )
        endTransaction()
      }

      return null
    })

    handle(InputSystemEvents.INPUT_DRAG_END, (snapshot: any) => {
      const { primaryTool, mouse } = snapshot

      if (primaryTool === PrimaryToolType.RECTANGLE && createdElementId) {
        const api = createElementFeature.api as any

        const dragStart = mouse.dragStart || mouse.position
        const hasMoved = api.hasMovedWithViewport(dragStart, mouse.position)

        if (!hasMoved) {
          startTransaction()
          api.resetElementSize(createdElementId)
          endTransaction()
        }

        dragStartWorkspacePos = null
      }

      createdElementId = null
      return null
    })
  }
})
