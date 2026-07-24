/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const fs = require('node:fs')
const path = require('node:path')

const projectRoot = path.resolve(__dirname, '../..')
const rendererSource = fs
  .readFileSync(path.join(__dirname, 'viewer.js'), 'utf8')
  .trimEnd()

const targetEntries = [
  path.join(
    projectRoot,
    'docs/ai/apps/asyra-design/plans/remote-subtree-restore-snapshot-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/apps/asyra-design/plans/group-interaction-mvp-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/framework/plans/transaction-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/framework/plans/render-engine-boundary-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/framework/plans/canvas-pipeline-debugger-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/framework/plans/property-type-redefinition-flow-inspector.html'
  ),
  path.join(
    projectRoot,
    'docs/ai/framework/plans/group-component-and-hierarchy-flow-inspector.html'
  )
]

const embeddedScript = `    <script data-flow-inspector-renderer>\n${rendererSource}\n    </script>`
const externalRendererPattern =
  /[ ]{4}<script src=["'][^"']*tools\/flow-inspector\/viewer\.js["']><\/script>/
const embeddedRendererPattern =
  /[ ]{4}<script data-flow-inspector-renderer>\n[\s\S]*?\n[ ]{4}<\/script>/

for (const entryPath of targetEntries) {
  const html = fs.readFileSync(entryPath, 'utf8')
  const nextHtml = externalRendererPattern.test(html)
    ? html.replace(externalRendererPattern, embeddedScript)
    : html.replace(embeddedRendererPattern, embeddedScript)

  if (nextHtml === html && !html.includes(embeddedScript)) {
    throw new Error(`No Flow Inspector renderer slot found in ${entryPath}`)
  }

  fs.writeFileSync(entryPath, nextHtml)
}
