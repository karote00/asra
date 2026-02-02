/**
 * App-level create element behavior
 */

import core from '@asyra/core'
import { EntityTypes, PositionData } from '@asyra/utils'
import {
  selectElements,
  startTransaction,
  endTransaction
} from '../events'
import { PrimaryToolType } from '../../constants'

export const createRectangleBehavior = (position: PositionData) => {
  const pos = core.deps.render.getMousePosInWorkspace({
    clientX: position.x,
    clientY: position.y
  })

  startTransaction()
  const inUndoRedo = core.deps.factory.isInUndoRedo()
  const newElementId = core.deps.sceneTree.addNewElement(
    {
      type: EntityTypes.RECTANGLE,
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0
    },
    undefined,
    -1,
    inUndoRedo
  )
  selectElements([newElementId])
  endTransaction()
}

export const createElementsBehavior = (
  position: PositionData,
  elementType: PrimaryToolType
) => {
  switch (elementType) {
    case PrimaryToolType.RECTANGLE:
      createRectangleBehavior(position)
      break
  }
}
