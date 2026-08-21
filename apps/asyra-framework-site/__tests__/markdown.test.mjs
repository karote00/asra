import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMarkdownBlocks, slugifyHeading } from '../lib/markdown.mjs'

test('markdown parsing preserves readable structural blocks and stable anchors', () => {
  const blocks = parseMarkdownBlocks(`# Build safely

Use **one owner** and \`one path\`.

## Flow

1. Intent enters.
2. State commits.

## Flow

- Render follows state.

| Owner | Result |
| --- | --- |
| Factory | committed |

\`\`\`ts
core.start()
\`\`\`
`)

  assert.deepEqual(
    blocks.map(({ type }) => type),
    [
      'heading',
      'paragraph',
      'heading',
      'list',
      'heading',
      'list',
      'table',
      'code'
    ]
  )
  assert.equal(blocks[0].id, 'build-safely')
  assert.equal(blocks[2].id, 'flow')
  assert.equal(blocks[4].id, 'flow-2')
  assert.equal(blocks[3].ordered, true)
  assert.equal(blocks[5].ordered, false)
  assert.deepEqual(blocks[6].headers, ['Owner', 'Result'])
  assert.equal(blocks[7].language, 'ts')
  assert.equal(blocks[7].code, 'core.start()')
})

test('heading slugs normalize package and punctuation syntax deterministically', () => {
  assert.equal(
    slugifyHeading('`@asyra/core`: Start & compose'),
    'asyra-core-start-and-compose'
  )
})
