import { selectionApis } from '../common-apis'

export const selectElements = (elementIds: string[]) => {
  selectionApis.selectElements(elementIds)
}

export const toggleElementSelection = (elementId: string) => {
  selectionApis.toggleSelection(elementId)
}

export const clearSelection = () => {
  selectionApis.clearSelection()
}
