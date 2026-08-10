import assert from 'node:assert/strict'
import test from 'node:test'
import { loadContentBundle } from '../lib/content.mjs'
import {
  createSlugger,
  markdownHeadings,
  parseMarkdown,
  plainText
} from '../lib/markdown.mjs'

test('Markdown parser preserves headings, prose, lists, tables, and code', () => {
  const source = `# A title

Plain [linked text](guide.md) and \`inline code\`.

- first
- second

1. one
2. two

| Owner | Role |
| --- | --- |
| App | Domain |

\`\`\`ts
const state = 'verified'
\`\`\`
`
  assert.deepEqual(parseMarkdown(source), [
    { type: 'heading', depth: 1, id: 'a-title', value: 'A title' },
    {
      type: 'paragraph',
      value: 'Plain [linked text](guide.md) and `inline code`.'
    },
    { type: 'list', ordered: false, items: ['first', 'second'] },
    { type: 'list', ordered: true, items: ['one', 'two'] },
    {
      type: 'table',
      header: ['Owner', 'Role'],
      rows: [['App', 'Domain']]
    },
    { type: 'code', language: 'ts', value: "const state = 'verified'" }
  ])
})

test('heading slugs are deterministic, readable, and collision safe', () => {
  const slug = createSlugger()
  const packageIdentity = '@asyra/core'
  const expectedIdentity = packageIdentity.replace(/[@/]/g, '')
  assert.equal(
    slug(`\`${packageIdentity}\` owns state`),
    `${expectedIdentity}-owns-state`
  )
  assert.equal(
    slug(`\`${packageIdentity}\` owns state`),
    `${expectedIdentity}-owns-state-1`
  )
  assert.equal(plainText('[Build now](start.md)'), 'Build now')
})

test('all accepted public Markdown uses supported blocks and exact headings', () => {
  const bundle = loadContentBundle()
  bundle.pages.forEach((page) => {
    const blocks = parseMarkdown(page.markdown)
    assert.ok(blocks.length > 0, page.id)
    assert.deepEqual(markdownHeadings(page.markdown), page.headings, page.id)
  })
})

test('unclosed code fences fail closed', () => {
  assert.throws(
    () => parseMarkdown('```ts\nconst value = 1'),
    /Unclosed Markdown fence/
  )
})
