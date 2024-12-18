import { Signal, signal, effect } from '@preact/signals-react'
import { ElementRawData, EntityTypes, GroupRawData } from '@asra/utils'

type UINormalElementData = ElementRawData
type UIGroupElementData = GroupRawData & { children: string[] }

type UIElementData = Partial<UINormalElementData | UIGroupElementData>

export const rootId = signal('ws-1')
const root = signal({
  id: rootId.value,
  name: 'Workspace',
  children: [],
  type: EntityTypes.WORKSPACE
})
export const elements = signal<{ [key: string]: Signal<UIElementData> }>({
  [rootId.value]: root
})
export const flattenedElementIds = signal<string[]>([])

export const getElement = (
  elementId: string
): Signal<UIElementData> | undefined => {
  return elements.value[elementId]
}

export const isGroup = (element: UIElementData) => {
  return 'children' in element
}

export const collectChildrenIds = (elementId: string, ids: string[]): void => {
  const elementS = getElement(elementId)
  if (!elementS) return

  const element = elementS.value
  ids.push(element.id!)
  if (isGroup(element)) {
    ;(element as UIGroupElementData).children.forEach((childId: string) => {
      const child = getElement(childId)?.value
      if (!child) return

      collectChildrenIds(childId, ids)
    })
  }
}

export const getFlattenedElementIds = (): string[] => {
  const rootInstance = root.value
  const ids: string[] = []

  rootInstance.children.forEach((childId) => {
    collectChildrenIds(childId, ids)
  })

  return ids
}

effect(() => {
  flattenedElementIds.value = flattenedElementIds.peek()
})

export const addElement = (
  parentId: string,
  data: any,
  index: number = -1
): void => {
  const parent = getElement(parentId) as Signal<GroupRawData>
  const avaliableParent =
    parent ?? (getElement(rootId.value) as Signal<GroupRawData>)
  if (avaliableParent) {
    const idx = index > -1 ? index : avaliableParent.value.children.length
    const children = avaliableParent.value.children
    children.splice(idx, 0, data.id)
    avaliableParent.value = {
      ...avaliableParent.value,
      children
    }

    elements.value = {
      ...elements.value,
      [data.id]: signal(data)
    }

    flattenedElementIds.value = getFlattenedElementIds()
  }
}

export const removeElement = (parentId: string, data: any): void => {}
