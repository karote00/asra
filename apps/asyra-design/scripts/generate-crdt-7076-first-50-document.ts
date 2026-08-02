import { readFile, writeFile } from 'node:fs/promises'
import { gunzipSync, gzipSync } from 'node:zlib'

type RawRecord = Record<string, unknown>

interface RawDocument {
  version: string
  sceneTree: {
    workspace: string
    workspaceList: string[]
    elements: Record<string, RawRecord>
  }
  props: Record<string, RawRecord>
}

const sourceUrl = new URL(
  '../samples/crdt-7076/document.json.gz',
  import.meta.url
)
const outputUrl = new URL(
  '../samples/crdt-7076-first-50/document.json.gz',
  import.meta.url
)

const source = JSON.parse(
  gunzipSync(await readFile(sourceUrl)).toString('utf8')
) as RawDocument
const selectedEntries = Object.entries(source.sceneTree.elements).slice(0, 50)
const selectedElementIds = new Set(
  selectedEntries.map(([elementId]) => elementId)
)
const selectedProps: Record<string, RawRecord> = {}
const pendingPropertyIds = selectedEntries.flatMap(([, element]) =>
  Object.values((element.props as Record<string, string> | undefined) ?? {})
)

const enqueueReferencedProperties = (value: unknown): void => {
  if (typeof value === 'string') {
    if (source.props[value] && !selectedProps[value]) {
      pendingPropertyIds.push(value)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach(enqueueReferencedProperties)
    return
  }
  if (value && typeof value === 'object') {
    Object.values(value as RawRecord).forEach(enqueueReferencedProperties)
  }
}

while (pendingPropertyIds.length > 0) {
  const propertyId = pendingPropertyIds.shift()
  if (!propertyId || selectedProps[propertyId]) {
    continue
  }
  const property = source.props[propertyId]
  if (!property) {
    throw new Error(
      `[generate-crdt-7076-first-50-document] missing property ${propertyId}`
    )
  }
  selectedProps[propertyId] = property
  enqueueReferencedProperties(property)
}

const elements = Object.fromEntries(
  selectedEntries.map(([elementId, element]) => [
    elementId,
    Array.isArray(element.children)
      ? {
          ...element,
          children: element.children.filter(
            (childId) =>
              typeof childId === 'string' && selectedElementIds.has(childId)
          )
        }
      : element
  ])
)
const document: RawDocument = {
  version: source.version,
  sceneTree: {
    workspace: source.sceneTree.workspace,
    workspaceList: [...source.sceneTree.workspaceList],
    elements
  },
  props: selectedProps
}

const vectorEntries = selectedEntries.filter(
  ([, element]) => element.type === 'vector'
)
const pointCount = vectorEntries.reduce((total, [, element]) => {
  const pointsPropertyId = (element.props as Record<string, string>).points
  const pointsProperty = selectedProps[pointsPropertyId]
  return (
    total + ((pointsProperty?.points as unknown[] | undefined)?.length ?? 0)
  )
}, 0)
const denseVectorCount = vectorEntries.filter(([, element]) => {
  const pointsPropertyId = (element.props as Record<string, string>).points
  const pointsProperty = selectedProps[pointsPropertyId]
  return (
    ((pointsProperty?.points as unknown[] | undefined)?.length ?? 0) > 1_000
  )
}).length

if (
  selectedEntries.length !== 50 ||
  vectorEntries.length !== 48 ||
  pointCount !== 22_928 ||
  denseVectorCount !== 5
) {
  throw new Error(
    '[generate-crdt-7076-first-50-document] bounded sample contract changed'
  )
}

await writeFile(outputUrl, gzipSync(JSON.stringify(document), { level: 9 }))
