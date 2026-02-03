import { SELECTION_TYPES } from "@asyra/utils";
import { startTransaction, endTransaction, selectElements } from "../events";
import { selection } from "../../contexts";

export const selectionApis = {
  selectElements: (elementIds: string[]) => {
    startTransaction()
    // TODO: 重新思考完整流程，什麼時候發送事件，什麼時候更新套件，什麼時候取得結果，API 又該負責什麼
    // const elementSelection = selection.get(SELECTION_TYPES.ELEMENT)
    // if (elementSelection) {
    //   elementSelection.select(elementIds)
    // }
    // selectElements(elementIds)
    endTransaction()
  }
}