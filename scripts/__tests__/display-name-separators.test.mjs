import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)
const roots = new Set(['apps', 'packages', 'tools', 'create-app', 'scripts'])
const extensions = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.html',
  '.mdx',
  '.json'
])
const excluded = new Set([
  'node_modules',
  '.artifacts',
  'dist',
  'coverage',
  'test-results',
  'playwright-report',
  '__tests__',
  'e2e',
  '__fixtures__'
])

// Inspect authored separators, never normalize names loaded from user data.
function separatorLines(source) {
  const pattern = /\s(?:·|\\u00b7|\\xB7|&middot;|&#0*183;|&#x0*b7;)(?=\s|\{)/giu
  const namedLiteral =
    /\b(?:name|title|label)\s*:\s*(?:'[^'\n]* [|/–—] |"[^"\n]* [|/–—] |`[^`\n]* [|/–—] )/gu
  return [
    ...new Set(
      [...source.matchAll(pattern), ...source.matchAll(namedLiteral)].map(
        (match) =>
          source
            .slice(0, match.index + match[0].indexOf(match[0].trim()))
            .split('\n').length
      )
    )
  ]
}

test('display-name guard detects literal, JSX, template and encoded middle-dot separators', () => {
  for (const source of [
    "const label = 'Study · r1'",
    '<option>{item.name} · r{item.revision}</option>',
    '`Name · ${version}`',
    '<span>{name} ·\n {version}</span>',
    "<span>{name} ·{' '}{version}</span>",
    String.raw`'Name \u00b7 version'`,
    String.raw`'Name \xB7 version'`,
    '<title>Name &middot; Version</title>',
    '<title>Name &#183; Version</title>',
    '<title>Name &#xB7; Version</title>'
  ])
    assert.deepEqual(separatorLines(source), [1], source)
  assert.deepEqual(separatorLines('first\nName · Version\nlast'), [2])
})

test('display-name guard rejects alternative separators in authored name/title/label literals', () => {
  for (const source of [
    "title: 'Runtime Atlas | Asyra Framework'",
    'title: `${page.title} | Asyra Docs`',
    'name: "Candidate / Study"',
    "label: 'Candidate — Study'",
    "title: 'Study – Version'"
  ])
    assert.deepEqual(separatorLines(source), [1], source)
})

test('display-name guard allows hyphens, actual paths, runtime user text and standalone logo decoration', () => {
  for (const source of [
    '<option>{item.name} - r{item.revision}</option>',
    '<span>{savedUserName}</span>',
    '<a href="/docs/overview">Docs</a>',
    '<span>⌘Z / Ctrl+Z</span>',
    'a<span>·</span>'
  ])
    assert.deepEqual(separatorLines(source), [], source)
})

test('project-authored display surfaces do not introduce middle-dot separators', () => {
  const files = execFileSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    {
      cwd: repositoryRoot,
      encoding: 'utf8'
    }
  )
    .split('\0')
    .filter(Boolean)
  const violations = []
  for (const file of new Set(files)) {
    const segments = file.split('/')
    if (
      !roots.has(segments[0]) ||
      segments.some((part) => excluded.has(part)) ||
      !extensions.has(path.extname(file)) ||
      /\.(?:test|spec)\.[^.]+$/.test(file)
    )
      continue
    const fullPath = path.join(repositoryRoot, file)
    if (!fs.existsSync(fullPath)) continue
    for (const line of separatorLines(fs.readFileSync(fullPath, 'utf8')))
      violations.push(`${file}:${line}`)
  }
  assert.deepEqual(
    violations,
    [],
    'Use " - " for authored display-name/metadata separators:\n' +
      violations.join('\n')
  )
})
