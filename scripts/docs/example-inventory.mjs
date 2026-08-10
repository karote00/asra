#!/usr/bin/env node

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  EXAMPLE_SOURCES,
  loadExample
} from '../../docs/examples/run-example.mjs'
import { readApprovedExamplePackageInputs } from '../release/example-package-inputs.mjs'

export const EXAMPLE_INVENTORY_PATH = 'docs/examples/inventory.json'

const occurrences = (source, marker) => {
  const indexes = []
  let offset = 0
  while (offset < source.length) {
    const index = source.indexOf(marker, offset)
    if (index === -1) break
    indexes.push(index)
    offset = index + marker.length
  }
  return indexes
}

export const extractSourceRegion = ({ source, region, sourcePath }) => {
  const startMarker = `// #region ${region}`
  const endMarker = `// #endregion ${region}`
  const starts = occurrences(source, startMarker)
  const ends = occurrences(source, endMarker)
  if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
    throw new Error(
      `${sourcePath} requires exactly one ordered ${region} source region`
    )
  }
  const contentStart = source.indexOf('\n', starts[0] + startMarker.length)
  if (contentStart === -1) {
    throw new Error(`${sourcePath} ${region} region has no content`)
  }
  return source.slice(contentStart + 1, ends[0])
}

export const createExampleInventory = async ({ repositoryRoot }) => {
  const root = path.resolve(repositoryRoot)
  const packageInputs = readApprovedExamplePackageInputs({
    repositoryRoot: root
  })
  const packagesByName = new Map(
    packageInputs.packages.map((record) => [record.name, record])
  )
  const examples = []

  for (const [index, id] of Object.keys(EXAMPLE_SOURCES).entries()) {
    const example = await loadExample(id)
    const absoluteSource = path.join(root, example.source)
    const source = fs.readFileSync(absoluteSource, 'utf8')
    const snippet = extractSourceRegion({
      source,
      region: example.definition.sourceRegion,
      sourcePath: example.source
    })
    const publicPackages = example.definition.publicPackages.map((name) => {
      const record = packagesByName.get(name)
      if (!record) {
        throw new Error(`${id} requires unknown public package ${name}`)
      }
      return Object.freeze({
        name,
        publicEntries: record.publicEntries,
        version: record.version
      })
    })
    examples.push(
      Object.freeze({
        environment: example.definition.environment,
        expectedResult: example.definition.expectedResult,
        id,
        objective: example.definition.objective,
        order: index + 1,
        ownership: example.definition.ownership,
        publicPackages,
        runCommand: example.definition.runCommand,
        snippet,
        snippetSha256: createHash('sha256').update(snippet).digest('hex'),
        source: example.source,
        sourceRegion: example.definition.sourceRegion,
        title: example.definition.title
      })
    )
  }

  return Object.freeze({
    examples: Object.freeze(examples),
    release: Object.freeze({
      family: packageInputs.releaseFamily,
      packageCount: packageInputs.packages.length,
      status: packageInputs.status,
      supportContract: packageInputs.supportContract
    }),
    runtime: packageInputs.runtime,
    schemaVersion: 1
  })
}

export const serializeExampleInventory = (inventory) =>
  `${JSON.stringify(inventory, null, 2)}\n`

export const writeExampleInventory = async ({ repositoryRoot }) => {
  const inventory = await createExampleInventory({ repositoryRoot })
  fs.writeFileSync(
    path.join(repositoryRoot, EXAMPLE_INVENTORY_PATH),
    serializeExampleInventory(inventory)
  )
  return inventory
}

export const checkExampleInventory = async ({ repositoryRoot }) => {
  const expected = serializeExampleInventory(
    await createExampleInventory({ repositoryRoot })
  )
  const inventoryPath = path.join(repositoryRoot, EXAMPLE_INVENTORY_PATH)
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(
      `${EXAMPLE_INVENTORY_PATH} is missing; run yarn examples:inventory`
    )
  }
  const actual = fs.readFileSync(inventoryPath, 'utf8')
  if (actual !== expected) {
    throw new Error(
      `${EXAMPLE_INVENTORY_PATH} is stale; run yarn examples:inventory`
    )
  }
  return JSON.parse(actual)
}

const isDirectInvocation =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectInvocation) {
  const [mode, ...unexpected] = process.argv.slice(2)
  if (!['--check', '--write'].includes(mode) || unexpected.length > 0) {
    throw new Error(
      'Usage: node scripts/docs/example-inventory.mjs --check|--write'
    )
  }
  const repositoryRoot = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../..'
  )
  const inventory =
    mode === '--write'
      ? await writeExampleInventory({ repositoryRoot })
      : await checkExampleInventory({ repositoryRoot })
  process.stdout.write(
    `Example inventory ${mode === '--write' ? 'written' : 'current'}: ${inventory.examples.length} examples\n`
  )
}
