/* eslint-disable @typescript-eslint/no-require-imports */
const path = require('node:path')
const { createService, LOCAL_ACTOR } = require('./service.cjs')
const { startServer } = require('./server.cjs')
const repositoryRoot = path.resolve(__dirname, '../../..')

const describe = (record) => {
  const evidence = record.evidence
  console.log(
    record.id + ' - ' + record.phase + ' - ' + (evidence?.status ?? 'unknown')
  )
  if (record.snapshot)
    console.log(
      'Captured source: ' +
        record.snapshot.digest +
        ' (HEAD ' +
        record.snapshot.head +
        ')'
    )
  for (const flow of evidence?.flows ?? [])
    console.log(flow.id + ': ' + flow.status)
  for (const item of evidence?.cases.filter(
    (item) => item.status !== 'passed'
  ) ?? []) {
    console.log(item.id + ' - ' + item.stepId + ' - ' + item.status)
    for (const failure of item.failures) console.log(failure)
  }
  for (const issue of evidence?.issues ?? []) console.log(issue)
  if (record.error) console.log(record.error)
  console.log(
    'Artifacts: ' +
      (record.artifactDirectory ?? 'tmp/flow-inspector/runs/' + record.id)
  )
}
async function main(args = process.argv.slice(2)) {
  const [command, flowId, ...extra] = args
  if (
    !['serve', 'verify', 'negative', 'prove'].includes(command) ||
    extra.length ||
    ((command === 'serve' || command === 'prove') && flowId)
  ) {
    throw new Error(
      'Usage: node tools/flow-inspector/control-plane/cli.cjs serve | verify [flow-id] | negative [flow-id] | prove'
    )
  }
  if (command === 'serve') {
    const server = await startServer(repositoryRoot)
    console.log('Flow Inspector Core Proof: ' + server.origin)
    console.log(
      'Local trusted workspace - Ctrl+C stops and settles active work.'
    )
    let stopping = false
    const stop = async () => {
      if (stopping) return
      stopping = true
      await server.close()
    }
    process.once('SIGINT', () =>
      stop().catch((error) => {
        console.error(error.message)
        process.exitCode = 1
      })
    )
    process.once('SIGTERM', () =>
      stop().catch((error) => {
        console.error(error.message)
        process.exitCode = 1
      })
    )
    return
  }
  const service = createService(repositoryRoot)
  const run = async (scenario) => {
    const request = { scenario }
    if (flowId) request.flowIds = [flowId]
    const record = await service.wait(service.start(request, LOCAL_ACTOR))
    describe(record)
    return record
  }
  try {
    if (command === 'prove') {
      const baseline = await run('baseline')
      if (baseline.evidence?.status !== 'passed')
        throw new Error('Baseline proof failed')
      const negative = await run('inverse-regression')
      const failed = negative.evidence?.cases
        .filter((item) => item.status === 'failed')
        .map((item) => item.id)
        .sort()
      const expected = service.contract().negativeCaseIds.slice().sort()
      if (
        negative.phase !== 'completed' ||
        negative.runner.code === 0 ||
        negative.evidence.issues.length ||
        JSON.stringify(failed) !== JSON.stringify(expected) ||
        negative.evidence.flows.find(
          (flow) => flow.id === 'deferred-publication'
        )?.status !== 'passed'
      )
        throw new Error(
          'Negative proof did not produce the exact expected cross-flow violation'
        )
      const recovered = await run('baseline')
      if (
        recovered.evidence?.status !== 'passed' ||
        baseline.snapshot.digest !== recovered.snapshot.digest
      )
        throw new Error(
          'Baseline recovery failed or source changed during proof'
        )
      console.log(
        'Core proof passed: baseline, precise cross-flow rejection, and recovery.'
      )
    } else {
      const record = await run(
        command === 'negative' ? 'inverse-regression' : 'baseline'
      )
      if (record.phase !== 'completed' || record.evidence?.status !== 'passed')
        process.exitCode = 1
    }
  } finally {
    await service.close()
  }
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
module.exports = { main }
