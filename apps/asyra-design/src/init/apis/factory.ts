import { EventTypes, UpdateTransactionEvent } from "@asyra/reactive-events"
import { factory } from "../../contexts"

export const factoryApis = {
  startTransaction: () => {
    factory.startTransaction()
  },
  updateTransaction: (event: Omit<UpdateTransactionEvent, 'type'>) => {
    factory.updateTransaction({
      type: EventTypes.UPDATE_TRANSACTION,
      ...event
    })
  },
  endTransaction: () => {
    factory.endTransaction()
  },
  undo: () => {
    factory.undo()
  },
  redo: () => {
    factory.redo()
  }
}