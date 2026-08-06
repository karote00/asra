import { writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { JSDOM } from 'jsdom'
import type { PreparedDrawingArtifact } from '../src/ai/prepared-drawing-artifact'

const FILE_ID = 'crdt-7076-sample'
const EXPECTED_ELEMENT_COUNT = 7_076
const outputUrl = new URL(
  '../samples/crdt-7076/document.json.gz',
  import.meta.url
)

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'http://localhost/'
})
Object.defineProperties(globalThis, {
  document: { configurable: true, value: dom.window.document },
  HTMLElement: { configurable: true, value: dom.window.HTMLElement },
  localStorage: { configurable: true, value: dom.window.localStorage },
  navigator: { configurable: true, value: dom.window.navigator },
  window: { configurable: true, value: dom.window }
})

const [
  { applyPreset },
  { createServerResponseRecord },
  { createAiActions },
  { transactionApis },
  { createEmptyDocument },
  { AiActionNames },
  { default: core },
  { initAiDrawingProgress }
] = await Promise.all([
  import('@asyra/preset'),
  import('../e2e/action-batch-interceptor'),
  import('../src/ai/actions'),
  import('../src/common-apis'),
  import('../src/config/empty-document'),
  import('../src/constants'),
  import('../src/contexts'),
  import('../src/init/capabilities/init-ai-drawing-progress')
])

applyPreset(core)
initAiDrawingProgress()
core.load(createEmptyDocument())
core.sceneTreeInit()

const record = await createServerResponseRecord(FILE_ID, 7_075)
const preparedAction = record.batch.actions.find(
  ({ name }) => name === AiActionNames.INSERT_VECTOR_COMPOSITION
)
const insertAction = createAiActions(undefined, {
  waitForPaint: async () => undefined,
  yieldToHost: async () => undefined
}).find(({ name }) => name === AiActionNames.INSERT_VECTOR_COMPOSITION)

if (!preparedAction || !insertAction) {
  throw new Error(
    '[generate-crdt-7076-document] prepared insert action is unavailable'
  )
}

await transactionApis.runTransaction(() =>
  insertAction.execute(preparedAction.arguments as PreparedDrawingArtifact, {
    signal: new AbortController().signal
  })
)

const document = await core.save()
const canonicalElementCount =
  Object.keys(document.sceneTree.elements).length -
  document.sceneTree.workspaceList.length
if (canonicalElementCount !== EXPECTED_ELEMENT_COUNT) {
  throw new Error(
    `[generate-crdt-7076-document] expected ${String(
      EXPECTED_ELEMENT_COUNT
    )} elements, received ${String(canonicalElementCount)}`
  )
}

await writeFile(outputUrl, gzipSync(JSON.stringify(document), { level: 9 }))
