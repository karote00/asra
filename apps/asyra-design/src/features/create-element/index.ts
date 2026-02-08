import { defineFeature } from '@asyra/feature-system'
import { EntityTypes, DEFAULT_ELEMENT_SIZE } from '@asyra/utils'
import { changeComputedData, selectElements } from '@asyra/reactive-events'
import { render, sceneTree } from '../../contexts'
import { elementApis, transactionApis } from '../../common-apis'
import { PrimaryToolType } from '../../constants'

interface CreateElementState {
  elementId: string | null
  dragStartWorkspacePos: { x: number; y: number } | null
}

export const createElementFeature = defineFeature(
  'createElement',
  'input.drag',
  {
    priority: 10,
    exclusive: true,
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
        elementApis.resetElementSize(elementId, DEFAULT_ELEMENT_SIZE)
      },
      hasMovedWithViewport: (
        clientDragStart: { x: number; y: number },
        clientCurrentPos: { x: number; y: number }
      ) => {
        return elementApis.hasMovedWithViewport(
          clientDragStart,
          clientCurrentPos,
          render as any
        )
      }
    },
    session: {
      start: (snapshot: any) => {
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

        transactionApis.startTransaction()
        const elementId = api.createRectangle(snapshot.mouse.position)
        if (elementId) {
          selectElements([elementId])
        }
        transactionApis.endTransaction()

        return {
          elementId,
          dragStartWorkspacePos: dragStartWorkspace
        } as CreateElementState
      },
      update: (snapshot: any, state: CreateElementState) => {
        if (
          !state ||
          state.elementId === null ||
          !state.dragStartWorkspacePos
        ) {
          return
        }

        const currentWorkspacePos = render!.getMousePosInWorkspace({
          clientX: snapshot.mouse.position.x,
          clientY: snapshot.mouse.position.y
        })

        transactionApis.startTransaction()
        const api = createElementFeature.api
        api.updateElementSizeAndPosition(
          state.elementId,
          state.dragStartWorkspacePos,
          currentWorkspacePos
        )
        transactionApis.endTransaction()
      },
      end: (snapshot: any, state: CreateElementState) => {
        if (!state || state.elementId === null) {
          return
        }

        const api = createElementFeature.api
        const hasMoved = api.hasMovedWithViewport(
          snapshot.mouse.dragStart || snapshot.mouse.position,
          snapshot.mouse.position
        )

        if (!hasMoved) {
          transactionApis.startTransaction()
          api.resetElementSize(state.elementId)
          transactionApis.endTransaction()
        }
      }
    }
  }
)
