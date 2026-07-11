const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const projectRoot = path.resolve(__dirname, '../..')
const rendererPath = path.join(__dirname, 'viewer.js')
const rendererSource = fs.readFileSync(rendererPath, 'utf8').trimEnd()

const targets = [
  {
    id: 'stroke-engine',
    entryPath: path.join(
      projectRoot,
      'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.html'
    ),
    dataScript: './stroke-flow-inspector.data.js'
  }
]

for (const target of targets) {
  test(`${target.id} viewer entry is directly openable and renderer-synchronized`, () => {
    const html = fs.readFileSync(target.entryPath, 'utf8')
    const embeddedRenderer = html.match(
      /<script data-flow-inspector-renderer>\n([\s\S]*?)\n    <\/script>/
    )

    assert.match(
      html,
      new RegExp(
        `<script src=["']${target.dataScript.replaceAll('.', '\\.')}["']><\\/script>`
      ),
      'target data must load from the viewer entry directory'
    )
    assert.doesNotMatch(
      html,
      /<script[^>]+src=["'][^"']*tools\/flow-inspector\/viewer\.js["']/,
      'direct-open viewer entries must not load the renderer across directories'
    )
    assert.ok(embeddedRenderer, 'shared renderer must be embedded in the entry')
    assert.equal(
      embeddedRenderer[1],
      rendererSource,
      'embedded renderer must exactly match tools/flow-inspector/viewer.js'
    )
  })
}
