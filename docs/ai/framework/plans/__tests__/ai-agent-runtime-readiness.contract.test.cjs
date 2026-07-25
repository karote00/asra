/* eslint-disable @typescript-eslint/no-require-imports */
/* global __dirname, require */

const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const test = require('node:test')

const inspector = require('../ai-agent-runtime-flow-inspector.data.cjs')
const repoRoot = path.resolve(__dirname, '../../../../..')
const planPath = path.resolve(
  repoRoot,
  'docs/ai/framework/plans/ai-agent-runtime-plan.md'
)
const bddPath = path.resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/bdd-features/ai-agent-runtime.feature'
)
const plan = fs.readFileSync(planPath, 'utf8')
const bdd = fs.readFileSync(bddPath, 'utf8')
const compact = (value) => value.replace(/\s+/g, ' ')

const section = (heading) => {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = plan.match(
    new RegExp(`^### ${escaped}\\n([\\s\\S]*?)(?=^#{2,3} |(?![\\s\\S]))`, 'm')
  )
  assert.ok(match, `Missing product contract section: ${heading}`)
  return match[1]
}

test('thin product contract decides supported, unsupported, public, owner, case, and DoD behavior', () => {
  const requiredSections = [
    'Supported Behavior',
    'Unsupported Behavior',
    'Public Input Contracts',
    'Public Output Contracts',
    'Ownership And Forbidden Boundaries',
    'Provider Adapter Decision',
    'Failure Cleanup And Bypass Contract',
    'Product Cases',
    'Definition Of Done'
  ]

  requiredSections.forEach((heading) => {
    assert.ok(section(heading).trim().length > 0, `${heading} is empty`)
  })

  assert.match(
    plan,
    /Framework Release Gate 4 is active from baseline `0e3eee620`/
  )
  assert.match(plan, /Production implementation begins only after/)
  assert.doesNotMatch(plan, /Candidate contracts:/)
  assert.doesNotMatch(plan, /first provider adapter may target OpenAI/)
  assert.doesNotMatch(plan, /docs-only planning record/)
})

test('product contract fixes the provider strategy without a live key or dependency', () => {
  const provider = compact(section('Provider Adapter Decision'))

  assert.match(
    provider,
    /first production-capable adapter is a generic HTTP provider/i
  )
  assert.match(
    provider,
    /platform `fetch` or an injected fetch-compatible function/i
  )
  assert.match(provider, /adds no SDK or schema dependency/i)
  assert.match(provider, /never reads `OPENAI_API_KEY`/i)
  assert.match(
    provider,
    /deterministic fake providers remain the formal test and CI authority/i
  )
  assert.match(provider, /live provider test is a separate opt-in smoke gate/i)
})

test('readiness names complete preflight, no-prefix, transaction, bypass, cleanup, and isolation cases', () => {
  const supported = compact(section('Supported Behavior'))
  const bypasses = compact(section('Failure Cleanup And Bypass Contract'))
  const cases = compact(section('Product Cases'))
  const done = compact(section('Definition Of Done'))

  assert.match(
    supported,
    /validates the complete plan before the first mutation/i
  )
  assert.match(
    supported,
    /One accepted plan enters one app-owned transaction runner call/i
  )
  assert.match(
    supported,
    /programmatic task lifecycle.*does not open a canonical transaction/i
  )
  assert.match(bypasses, /AI-disabled: no package composition/i)
  assert.match(bypasses, /Provider-disabled:/i)
  assert.match(bypasses, /Non-collaborative:/i)
  assert.match(bypasses, /second invocation.*rejected/i)
  assert.match(bypasses, /never repeats a transaction or action executor/i)
  assert.match(cases, /no canonical prefix/i)
  assert.match(cases, /isolated registries\/providers\/in-flight state/i)
  assert.match(done, /No live API key or live vendor smoke test is required/i)
})

test('Inspector covers each required Gate 4 owner and bypass family', () => {
  const ids = new Set(inspector.steps.map((item) => item.id))
  ;[
    'compose-ai-runtime',
    'route-natural-language-intent',
    'collect-app-context',
    'describe-action-registry',
    'request-provider-plan',
    'normalize-provider-result',
    'validate-complete-plan',
    'evaluate-app-permissions',
    'preview-confirm-plan',
    'run-plan-transaction',
    'execute-app-actions',
    'mutate-canonical-state',
    'settle-plan-transaction',
    'project-derived-output',
    'transport-optional-publication',
    'produce-redacted-audit',
    'cleanup-feature-invocation'
  ].forEach((id) => assert.ok(ids.has(id), id))

  const routeIds = new Set(inspector.routes.map((item) => item.id))
  ;[
    'bypass-ai-disabled',
    'bypass-provider-disabled',
    'retry-provider-attempt',
    'fail-complete-validation',
    'deny-complete-plan',
    'cancel-confirmation',
    'fail-action-batch',
    'bypass-non-collaborative',
    'finish-feature-invocation'
  ].forEach((id) => assert.ok(routeIds.has(id), id))
})

test('every Inspector step maps to a bounded product case and DoD', () => {
  const covered = new Set(
    inspector.acceptanceContracts.flatMap((contract) => contract.stepIds)
  )

  inspector.steps.forEach((item) => {
    assert.ok(covered.has(item.id), `${item.id} lacks acceptance coverage`)
    assert.ok(
      item.specRefs.some(
        (reference) =>
          reference === '#product-cases' ||
          reference === '#definition-of-done' ||
          reference === '#supported-behavior' ||
          reference === '#provider-adapter-decision'
      ),
      `${item.id} lacks a product/DoD reference`
    )
  })
})

test('Gherkin contract is present and remains app-owned', () => {
  assert.match(bdd, /^Feature: Optional AI agent runtime/m)
  assert.match(bdd, /Asyra Design owns the AI Feature lifecycle/)
  assert.match(
    bdd,
    /app owns context, actions, schemas, permission, confirmation, and transaction adapters/
  )
  assert.match(bdd, /deterministic providers require no live API key/)
  assert.doesNotMatch(bdd, /Given the AI runtime owns the Feature lifecycle/)
})

test('readiness adds no matrix, closure packet, ledger, or assertion registry', () => {
  const changedAuthorities = [plan, bdd, JSON.stringify(inspector)]
  changedAuthorities.forEach((content) => {
    assert.doesNotMatch(content, /readiness matrix/i)
    assert.doesNotMatch(content, /closure packet/i)
    assert.doesNotMatch(content, /audit ledger/i)
    assert.doesNotMatch(content, /assertion registry/i)
  })
})
