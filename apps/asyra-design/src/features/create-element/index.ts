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

interface CreateElementState {
  elementId: string | null
  dragStartWorkspacePos: { x: number; y: number } | null
}

export const createElementFeature = defineFeature(
  'createElement',
  'input.drag', // Session: auto-expands to start/update/end
  {
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
    define: ({ session }: any) => {
      session.start(
        InputSystemEvents.INPUT_DRAG_START,
        { priority: 10, exclusive: true },
        (snapshot: any) => {
          const { primaryTool } = snapshot

          if (primaryTool !== PrimaryToolType.RECTANGLE) {
            return null
          }

          if (!render) {
            return null
          }

          const api = createElementFeature.api as any
          const dragStartWorkspace = render!.getMousePosInWorkspace({
            clientX: snapshot.mouse.position.x,
            clientY: snapshot.mouse.position.y
          })

          startTransaction()
          const elementId = api.createRectangle(snapshot.mouse.position)
          endTransaction()

          if (elementId) {
            selectElements([elementId])
          }

          return {
            elementId,
            dragStartWorkspacePos: dragStartWorkspace
          } as CreateElementState
        },
        (snapshot: any, state: CreateElementState) => {
          if (!state || state.elementId === null) {
            return
          }

          const currentWorkspacePos = render!.getMousePosInWorkspace({
            clientX: snapshot.mouse.position.x,
            clientY: snapshot.mouse.position.y
          })

          startTransaction()
          const api = createElementFeature.api as any
          api.updateElementSizeAndPosition(
            state.elementId,
            state.dragStartWorkspacePos,
            currentWorkspacePos
          )
          endTransaction()
        },
        (snapshot: any, state: CreateElementState) => {
          if (!state || state.elementId === null) {
            return
          }

          const api = createElementFeature.api as any
          const hasMoved = api.hasMovedWithViewport(
            snapshot.mouse.dragStart || snapshot.mouse.position,
            snapshot.mouse.position
          )

          if (!hasMoved) {
            startTransaction()
            api.resetElementSize(state.elementId)
            endTransaction()
          }
        }
      )
    }
  }
)
