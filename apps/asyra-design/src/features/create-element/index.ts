import core from '../../contexts'
import { InputSystemEvents, PrimaryToolType } from '../../constants'
import { defineFeature } from '@asyra/feature-system'
import { EntityTypes, DEFAULT_ELEMENT_SIZE } from '@asyra/utils'
import {
  addElement,
  changeComputedData,
  startTransaction,
  endTransaction
} from '@asyra/reactive-events'

let createdElementId: string | null = null

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
        y: pos.y,
        width: 0,
        height: 0
      } as any)

      console.log('[createElement] Created rectangle at position:', pos)
      return pos
    },
    updateElementSize: (
      elementId: string,
      dragStart: { x: number; y: number },
      currentPos: { x: number; y: number }
    ) => {
      const width = currentPos.x - dragStart.x
      const height = currentPos.y - dragStart.y
      console.log('[createElement] updateElementSize:', {
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
        startTransaction()
        const api = createElementFeature.api as any
        api.createRectangle(mouse.dragStart || mouse.position)
        endTransaction()

        createdElementId = getLastCreatedElementId()
      }

      return null
    })

    handle(InputSystemEvents.INPUT_DRAG_UPDATE, (snapshot: any) => {
      const { primaryTool, mouse } = snapshot

      console.log('[createElement] DRAG_UPDATE:', {
        primaryTool,
        mouse,
        createdElementId
      })

      if (
        primaryTool === PrimaryToolType.RECTANGLE &&
        mouse.dragging &&
        createdElementId
      ) {
        startTransaction()
        const api = createElementFeature.api as any
        api.updateElementSize(
          createdElementId,
          mouse.dragStart || mouse.position,
          mouse.position
        )
        endTransaction()
        console.log('[createElement] Updated size:', {
          width: mouse.position.x - (mouse.dragStart?.x || mouse.position.x),
          height: mouse.position.y - (mouse.dragStart?.y || mouse.position.y)
        })
      }

      return null
    })

    handle(InputSystemEvents.INPUT_DRAG_END, (snapshot: any) => {
      const { primaryTool, mouse } = snapshot

      console.log('[createElement] DRAG_END:', {
        primaryTool,
        mouse,
        createdElementId
      })

      if (primaryTool === PrimaryToolType.RECTANGLE && createdElementId) {
        const api = createElementFeature.api as any

        const dragStart = mouse.dragStart || mouse.position
        const hasMoved =
          Math.abs(mouse.position.x - dragStart.x) > 1 ||
          Math.abs(mouse.position.y - dragStart.y) > 1

        if (!hasMoved) {
          startTransaction()
          api.resetElementSize(createdElementId)
          endTransaction()
        }
      }

      createdElementId = null
      return null
    })
  }
})
