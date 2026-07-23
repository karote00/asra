import { systemContextApis } from '../common-apis'

export const setHoveredElementId = (elementId: string | null) => {
  systemContextApis.updateHoveredElementId(elementId)
}
