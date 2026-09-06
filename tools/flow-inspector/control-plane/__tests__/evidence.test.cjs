/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict')
const path = require('node:path')
const test = require('node:test')
const { assessEvidence } = require('../evidence.cjs')
const { loadContract } = require('../contracts.cjs')
const contract = loadContract(path.resolve(__dirname, '../../../..'))
const snapshot = { sourceRoot: '/captured', contractDigest: contract.digest }
const flowIds = contract.flows.map((flow) => flow.id)
function result() {
  return {
    code: 0,
    reason: null,
    report: {
      success: true,
      numTotalTests: 6,
      numFailedTests: 0,
      numPassedTests: 6,
      testResults: [
        {
          name: path.join(snapshot.sourceRoot, contract.testFile),
          status: 'passed',
          assertionResults: contract.cases.map((item) => ({
            fullName: item.testName,
            status: 'passed',
            failureMessages: []
          }))
        }
      ]
    }
  }
}
const assess = (runner) => assessEvidence(contract, snapshot, runner, flowIds)
test('accepts only the complete six-case baseline', () => {
  const evidence = assess(result())
  assert.equal(evidence.status, 'passed')
  assert.equal(evidence.passedCount, 6)
  assert.deepEqual(evidence.issues, [])
})
for (const [name, corrupt] of [
  [
    'missing report',
    (runner) => {
      runner.report = null
    }
  ],
  [
    'zero matches',
    (runner) => {
      runner.report.testResults[0].assertionResults = []
    }
  ],
  [
    'missing case',
    (runner) => {
      runner.report.testResults[0].assertionResults.pop()
    }
  ],
  [
    'duplicate case',
    (runner) => {
      runner.report.testResults[0].assertionResults.push(
        runner.report.testResults[0].assertionResults[0]
      )
    }
  ],
  [
    'skipped case',
    (runner) => {
      runner.report.testResults[0].assertionResults[0].status = 'pending'
    }
  ],
  [
    'wrong source',
    (runner) => {
      runner.report.testResults[0].name = '/other/test.ts'
    }
  ],
  [
    'unknown case',
    (runner) => {
      runner.report.testResults[0].assertionResults[0].fullName = 'made-up pass'
    }
  ],
  [
    'summary mismatch',
    (runner) => {
      runner.report.numPassedTests = 99
    }
  ],
  [
    'suite failure',
    (runner) => {
      runner.report.testResults[0].status = 'failed'
    }
  ],
  [
    'runtime error',
    (runner) => {
      runner.report.numRuntimeErrorTestSuites = 1
    }
  ],
  [
    'failed exit',
    (runner) => {
      runner.code = 1
    }
  ],
  [
    'cancellation',
    (runner) => {
      runner.reason = 'cancelled'
    }
  ],
  [
    'malformed assertion',
    (runner) => {
      runner.report.testResults[0].assertionResults[0] = null
    }
  ]
])
  test('rejects ' + name, () => {
    const runner = result()
    corrupt(runner)
    assert.notEqual(assess(runner).status, 'passed')
  })
test('a zero-exit wrapper cannot conceal real assertion failures', () => {
  const runner = result()
  runner.report.testResults[0].assertionResults[0].status = 'failed'
  runner.report.numFailedTests = 1
  runner.report.numPassedTests = 5
  assert.equal(assess(runner).status, 'failed')
  assert.ok(
    assess(runner).issues.includes('Runner exit masked failed assertions')
  )
})
test('attributes failed obligations while preserving the passing other flow', () => {
  const runner = result()
  runner.code = 1
  runner.report.success = false
  runner.report.numFailedTests = 1
  runner.report.numPassedTests = 5
  runner.report.testResults[0].status = 'failed'
  runner.report.testResults[0].assertionResults[4].status = 'failed'
  const evidence = assess(runner)
  assert.equal(evidence.flows[0].status, 'passed')
  assert.equal(evidence.flows[1].status, 'failed')
  assert.equal(evidence.cases[4].stepId, 'finalize-transaction-state')
})
test('rejects mismatched contract provenance and empty selection', () => {
  assert.notEqual(
    assessEvidence(
      contract,
      { ...snapshot, contractDigest: 'old' },
      result(),
      flowIds
    ).status,
    'passed'
  )
  assert.notEqual(
    assessEvidence(contract, snapshot, result(), []).status,
    'passed'
  )
})
