/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const test = require('node:test')
const { admitContract } = require('../contracts.cjs')
const manifest = require('../../../../packages/factory/flow-contracts.json')
const architecture = require('../../inspectors/transaction-flow-inspector.data.cjs')

const admit = (change) => {
  const input = structuredClone({ manifest, architecture })
  change?.(input)
  return admitContract(input.manifest, input.architecture)
}

test('resolves two real flows and six obligations using architecture-owned steps', () => {
  const contract = admit()
  assert.equal(contract.flows.length, 2)
  assert.equal(contract.cases.length, 6)
  assert.equal(contract.flows[0].steps[0].ownerPackage, '@asyra/factory')
  assert.equal(contract.flows[0].steps[0].title, architecture.steps[1].title)
})

for (const [name, corrupt] of [
  [
    'unknown step',
    ({ manifest }) => {
      manifest.flows[0].cases[0].stepId = 'unknown'
    }
  ],
  [
    'empty requirements',
    ({ manifest }) => {
      manifest.flows[0].cases = []
    }
  ],
  [
    'duplicate case',
    ({ manifest }) => {
      manifest.flows[1].cases[0].id = manifest.flows[0].cases[0].id
    }
  ],
  [
    'missing case mapping',
    ({ manifest }) => {
      manifest.flows[0].cases[0].testName = ''
    }
  ],
  [
    'wrong owner',
    ({ architecture }) => {
      architecture.steps[1].ownerPackage = ''
    }
  ],
  [
    'missing producer',
    ({ architecture }) => {
      architecture.artifacts = architecture.artifacts.filter(
        (a) => a.id !== 'artifact:active-transaction-journal'
      )
    }
  ],
  [
    'broken route',
    ({ architecture }) => {
      architecture.routes[0].to = 'unknown'
    }
  ],
  [
    'undeclared external input',
    ({ manifest }) => {
      manifest.externalInputs = []
    }
  ],
  [
    'unsupported version',
    ({ manifest }) => {
      manifest.version = 99
    }
  ]
]) {
  test('rejects ' + name + ' before running a test', () =>
    assert.throws(() => admit(corrupt))
  )
}
