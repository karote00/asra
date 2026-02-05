import core from '../../contexts'
import { InputSystemEvents, PrimaryToolType } from '../../constants'
import { defineFeature } from '@asyra/feature-system'
import { EntityTypes, DEFAULT_ELEMENT_SIZE } from '@asyra/utils'
import {
  addElement,
  changeComputedData,
  selectElements,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'

let createdElementId: string | null = null
let dragStartWorkspacePos: { x: number; y: number } | null = null

const getLastCreatedElementId = () => {
  const factory = core.deps.factory
  const yjsChanges = factory.sceneTreeMap.toJSON()
  const addElementChanges = yjsChanges.filter((c) => c.action === 'addElement')
  const lastAdded = addElementChanges[addElementChanges.length - 1]
  return lastAdded ? lastAdded.data.id : null
}

export const createElementFeature = defineFeature('createElement', undefined, {
  name: 'createElement',
  api: {
    createRectangle: (position: { x: number; y: number }) => {
      const pos = core.deps.render!.getMousePosInWorkspace({
        clientX: position.x,
        clientY: position.y
      })

      addElement({
        type: EntityTypes.RECTANGLE,
        x: pos.x,
        y: pos.y
      } as any)

      console.log('[createElement] Created rectangle at position:', pos)
      return pos
    },
    updateElementSizeAndPosition: (
      elementId: string,
      dragStart: { x: number; y: number },
      currentPos: { x: number; y: number }
    ) => {
      const width = currentPos.x - dragStart.x
      const height = currentPos.y - dragStart.y
      console.log('[createElement] updateElementSizeAndPosition:', {
        elementId,
        dragStart,
        currentPos,
        width,
        height
      })

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
      const dragStartWorkspace = core.deps.render!.getMousePosInWorkspace({
        clientX: clientDragStart.x,
        clientY: clientDragStart.y
      })
      const currentWorkspace = core.deps.render!.getMousePosInWorkspace({
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

      console.log('[createElement] DRAG_START:', { primaryTool, mouse })

      if (primaryTool === PrimaryToolType.RECTANGLE && mouse.down) {
        const dragStart = mouse.dragStart || mouse.position
        const dragStartWorkspace = core.deps.render!.getMousePosInWorkspace({
          clientX: dragStart.x,
          clientY: dragStart.y
        })

        startTransaction()
        const api = createElementFeature.api as any
        api.createRectangle(dragStart)
        createdElementId = getLastCreatedElementId()
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

      console.log('[createElement] DRAG_UPDATE:', {
        primaryTool,
        mouse,
        createdElementId,
        dragStartWorkspacePos
      })

      if (
        primaryTool === PrimaryToolType.RECTANGLE &&
        mouse.dragging &&
        createdElementId &&
        dragStartWorkspacePos
      ) {
        const currentWorkspacePos = core.deps.render!.getMousePosInWorkspace({
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
        console.log('[createElement] Updated size:', {
          width: currentWorkspacePos.x - dragStartWorkspacePos.x,
          height: currentWorkspacePos.y - dragStartWorkspacePos.y
        })
      }

      return null
    })

    handle(InputSystemEvents.INPUT_DRAG_END, (snapshot: any) => {
      const { primaryTool, mouse } = snapshot

      console.log('[createElement] DRAG_END:', {
        primaryTool,
        mouse,
        createdElementId,
        dragStartWorkspacePos
      })

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
