/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const repoRoot = path.resolve(__dirname, '../../../../..')
const featurePath = path.resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/bdd-features/ai-agent-runtime.feature'
)
const source = fs.readFileSync(featurePath, 'utf8')

const scenarios = new Map(
  source
    .split(/^[ ]{2}Scenario: /m)
    .slice(1)
    .map((block) => {
      const [name, ...body] = block.split('\n')
      return [name, body.join('\n')]
    })
)

const scenario = (name) => {
  const value = scenarios.get(name)
  assert.ok(value, `Missing executable BDD scenario: ${name}`)
  return value
}

test('AI runtime Gherkin scenarios are executable contract inputs', () => {
  assert.equal(scenarios.size, 14)
  ;[
    'AI-disabled startup has zero AI side effects',
    'Provider-disabled invocation fails before planning',
    'Action registration is deterministic and duplicate-safe',
    'Unknown or schema-invalid action rejects the complete plan',
    'Permission denial rejects the complete plan',
    'Required confirmation can be accepted or cancelled',
    'Valid multi-action plan creates one undo commit',
    'Executor failure rolls back without a canonical prefix',
    'Provider failure retry is bounded and transaction-safe',
    'Abort timeout and disposal clean request resources',
    'Secret values are redacted from failures and audit output',
    'Runtime instances remain isolated',
    'Collaboration uses the ordinary canonical publication route',
    'Generic HTTP and fake providers are replaceable'
  ].forEach((name) => assert.ok(scenarios.has(name), name))
})

test('disabled routes assert zero side effects before planning', () => {
  assert.match(
    scenario('AI-disabled startup has zero AI side effects'),
    /no AI runtime or provider is constructed/
  )
  assert.match(
    scenario('AI-disabled startup has zero AI side effects'),
    /no AI Feature, network request, secret read, listener, or timer is created/
  )
  assert.match(
    scenario('Provider-disabled invocation fails before planning'),
    /context collection and provider transport are not invoked/
  )
})

test('registry schema permission and confirmation scenarios forbid partial execution', () => {
  assert.match(
    scenario('Action registration is deterministic and duplicate-safe'),
    /preserve successful registration order/
  )
  assert.match(
    scenario('Unknown or schema-invalid action rejects the complete plan'),
    /no action executor or transaction runner is invoked/
  )
  assert.match(
    scenario('Unknown or schema-invalid action rejects the complete plan'),
    /no valid canonical prefix is applied/
  )
  assert.match(
    scenario('Permission denial rejects the complete plan'),
    /before confirmation or transaction execution/
  )
  assert.match(
    scenario('Required confirmation can be accepted or cancelled'),
    /one immutable complete preview/
  )
})

test('accepted and failed execution scenarios preserve one transaction boundary', () => {
  assert.match(
    scenario('Valid multi-action plan creates one undo commit'),
    /every app action executor runs in plan order/
  )
  assert.match(
    scenario('Valid multi-action plan creates one undo commit'),
    /one intended undo commit/
  )
  assert.match(
    scenario('Executor failure rolls back without a canonical prefix'),
    /every rollbackable write from the plan is reversed/
  )
  assert.match(
    scenario('Executor failure rolls back without a canonical prefix'),
    /no normal undo commit or accepted canonical prefix remains/
  )
})

test('provider and lifecycle scenarios require bounded retry cleanup and redaction', () => {
  assert.match(
    scenario('Provider failure retry is bounded and transaction-safe'),
    /only provider planning is repeated/
  )
  assert.match(
    scenario('Abort timeout and disposal clean request resources'),
    /timers, listeners, retry state, and intermediate values are released/
  )
  assert.match(
    scenario('Abort timeout and disposal clean request resources'),
    /no later post-abort mutation is applied/
  )
  assert.match(
    scenario('Secret values are redacted from failures and audit output'),
    /secret values are recursively redacted/
  )
})

test('isolation collaboration and provider replacement retain ordinary owners', () => {
  assert.match(
    scenario('Runtime instances remain isolated'),
    /do not cross instances/
  )
  assert.match(
    scenario('Collaboration uses the ordinary canonical publication route'),
    /Factory emits the ordinary shared publication/
  )
  assert.match(
    scenario('Collaboration uses the ordinary canonical publication route'),
    /AI runtime owns no dedupe, permission, conflict, or reconnect policy/
  )
  assert.match(
    scenario('Generic HTTP and fake providers are replaceable'),
    /formal tests require no live endpoint or API key/
  )
})
