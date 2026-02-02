import { UpdateTransactionEvent } from "@asyra/reactive-events"
import { factory } from "../../contexts"

export const factoryApis = {
  startTransaction: () => {
    factory.startTransaction()
  },
  updateTransaction: (event: UpdateTransactionEvent) => {
    factory.updateTransaction(event)
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