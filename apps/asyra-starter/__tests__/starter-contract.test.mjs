import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('starter stays a minimal documented React shell', () => {
  const sourceFiles = fs.readdirSync(path.join(appRoot, 'src')).sort()

  assert.deepEqual(sourceFiles, [
    'App.tsx',
    'framework-logo.svg',
    'main.tsx',
    'styles.css',
    'vite-env.d.ts'
  ])
  assert.ok(fs.existsSync(path.join(appRoot, 'AGENTS.md')))
  assert.ok(fs.existsSync(path.join(appRoot, 'docs/framework.md')))
})

test('homepage exposes the original Framework mark and upstream guide', () => {
  const app = fs.readFileSync(path.join(appRoot, 'src/App.tsx'), 'utf8')
  const logo = fs.readFileSync(
    path.join(appRoot, 'src/framework-logo.svg'),
    'utf8'
  )

  assert.match(app, /Asyra Framework logo/u)
  assert.match(app, /docs\/ai\/framework\/GETTING_STARTED\.md/u)
  assert.match(logo, /id="framework-gradient"/u)
  assert.match(logo, /<title id="title">Asyra Framework<\/title>/u)
})
