import { EntityTypes, PositionData } from "@asyra/utils"
import { factory, render, sceneTree } from "../../contexts"
import { startTransaction, endTransaction, selectElements } from "../events"
import { PrimaryToolType } from "../../constants"

export const sceneTreeApis = {
  createRectangle: (position: PositionData) => {
    const pos = render.getMousePosInWorkspace({
      clientX: position.x,
      clientY: position.y
    })

    startTransaction()
    const inUndoRedo = factory.isInUndoRedo()
    const newElementId = sceneTree.addNewElement(
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
  },
  createElements: (
    position: PositionData,
    elementType: PrimaryToolType
  ) => {
    switch (elementType) {
      case PrimaryToolType.RECTANGLE:
        sceneTreeApis.createRectangle(position)
        break
    }
  }
}