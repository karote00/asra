import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { formalStrokeTestResidueRecords } from './stroke-test-residue-coverage-map'

interface InspectorData {
  steps: { id: string }[]
  conditionalRoutes: { id: string }[]
  inspectorContractErrors: string[]
}

const repoRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../'
)
const presetPackagePath = resolve(repoRoot, 'packages/preset/package.json')
const plansPath = resolve(repoRoot, 'docs/ai/apps/asyra-design/PLANS.md')
const specPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
)
const inspectorPath = resolve(
  repoRoot,
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
)
const require = createRequire(import.meta.url)

const readJson = <T>(path: string): T =>
  JSON.parse(readFileSync(path, 'utf8')) as T

const walkFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    const stat = statSync(path)
    return stat.isDirectory() ? walkFiles(path) : [path]
  })

const toRepoPath = (path: string) => path.replace(`${repoRoot}/`, '')

const isTestFile = (path: string) => /\.(test|spec)\.tsx?$/.test(path)

const headingToAnchor = (heading: string) =>
  heading
    .replace(/^#+\s+/, '')
    .replace(/`/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')

const readSpecAnchors = () =>
  new Set(
    readFileSync(specPath, 'utf8')
      .split('\n')
      .filter((line) => /^#{2,4}\s+/.test(line))
      .map(headingToAnchor)
  )

const loadInspectorData = (): InspectorData => {
  const windowRecord: { STROKE_FLOW_INSPECTOR_DATA?: InspectorData } = {}
  ;(globalThis as typeof globalThis & { window?: unknown }).window =
    windowRecord
  Reflect.deleteProperty(require.cache, require.resolve(inspectorPath))
  require(inspectorPath)
  const data = windowRecord.STROKE_FLOW_INSPECTOR_DATA
  expect(data).toBeDefined()
  return data as InspectorData
}

const isStrokeGateTest = (path: string) =>
  path === 'packages/preset/src/__tests__/stroke-test-architecture.test.ts' ||
  path ===
    'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts' ||
  /^packages\/preset\/src\/__tests__\/stroke-flow\/step-\d{2}-[-a-z]+\.test\.ts$/.test(
    path
  ) ||
  /^packages\/preset\/src\/__tests__\/stroke-flow-validation\/[-a-z0-9]+\.test\.ts$/.test(
    path
  ) ||
  /^packages\/preset\/src\/__tests__\/stroke-flow-integration\/[-a-z0-9]+\.test\.ts$/.test(
    path
  ) ||
  /^packages\/preset\/src\/__tests__\/stroke-geometry-oracles\/[-a-z0-9]+\.test\.ts$/.test(
    path
  ) ||
  /^packages\/preset\/src\/__tests__\/stroke-regression\/[-a-z0-9]+\.test\.ts$/.test(
    path
  ) ||
  /^apps\/asyra-design\/e2e\/stroke-new-flow\/[-a-z0-9]+\.spec\.ts$/.test(path)

const getStrokeGateFiles = () =>
  [
    ...walkFiles(resolve(repoRoot, 'packages/preset/src/__tests__')),
    ...walkFiles(resolve(repoRoot, 'apps/asyra-design/e2e'))
  ]
    .map(toRepoPath)
    .filter(isTestFile)
    .filter(isStrokeGateTest)
    .sort()

const getOutsideStrokeLikeFormalTestFiles = () =>
  walkFiles(resolve(repoRoot, 'packages/preset/src/__tests__'))
    .map(toRepoPath)
    .filter(isTestFile)
    .filter((file) => !isStrokeGateTest(file))
    .filter((file) =>
      /stroke|Stroke|vector|Vector/.test(
        readFileSync(resolve(repoRoot, file), 'utf8')
      )
    )
    .sort()

const splitRef = (ref: string) => {
  const [filePath, fragment = ''] = ref.split('#')
  return { filePath, fragment }
}

describe('stroke test architecture', () => {
  it('keeps stroke scripts explicit and separate from full package and E2E gates', () => {
    const packageJson = readJson<{
      scripts: Record<string, string>
    }>(presetPackagePath)

    expect(packageJson.scripts['test:stroke-flow:unit']).toBe(
      'vitest run src/__tests__/stroke-test-architecture.test.ts src/__tests__/stroke-flow-refactor-protocol.test.ts src/__tests__/stroke-flow/step-*.test.ts --reporter=dot'
    )
    expect(packageJson.scripts['test:stroke-flow:validation']).toBe(
      'vitest run src/__tests__/stroke-flow-validation/*.test.ts --reporter=dot'
    )
    expect(packageJson.scripts['test:stroke-flow:integration']).toBe(
      'vitest run src/__tests__/stroke-test-architecture.test.ts src/__tests__/stroke-flow-integration/*.test.ts --reporter=dot'
    )
    expect(packageJson.scripts['test:stroke-geometry:oracle']).toBe(
      'vitest run src/__tests__/stroke-test-architecture.test.ts src/__tests__/stroke-geometry-oracles/*.test.ts --reporter=dot'
    )
    expect(packageJson.scripts['test:stroke:regression']).toBe(
      'vitest run src/__tests__/stroke-test-architecture.test.ts src/__tests__/stroke-regression/*.test.ts --reporter=dot'
    )
    expect(packageJson.scripts['test:stroke:new']).toBe(
      'yarn test:stroke-flow:unit && yarn test:stroke-flow:validation && yarn test:stroke-flow:integration && yarn test:stroke-geometry:oracle && yarn test:stroke:regression'
    )

    for (const scriptName of [
      'test:stroke-flow:unit',
      'test:stroke-flow:validation',
      'test:stroke-flow:integration',
      'test:stroke-geometry:oracle',
      'test:stroke:regression',
      'test:stroke:new'
    ]) {
      expect(packageJson.scripts[scriptName]).not.toContain('test:local')
      expect(packageJson.scripts[scriptName]).not.toContain('test:e2e')
    }
  })

  it('keeps only current stroke gate files in current stroke gate namespaces', () => {
    const strokeGateFiles = getStrokeGateFiles()

    expect(strokeGateFiles).toEqual(
      expect.arrayContaining([
        'packages/preset/src/__tests__/stroke-test-architecture.test.ts',
        'packages/preset/src/__tests__/stroke-flow-refactor-protocol.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-01-feature-session-intent.test.ts',
        'packages/preset/src/__tests__/stroke-flow/step-41-runtime-diagnostics.test.ts'
      ])
    )
    expect(
      strokeGateFiles.filter((file) =>
        /^packages\/preset\/src\/__tests__\/stroke-flow\/step-\d{2}-/.test(file)
      )
    ).toHaveLength(41)

    for (const file of strokeGateFiles) {
      expect(existsSync(resolve(repoRoot, file)), file).toBe(true)
      expect(isStrokeGateTest(file), file).toBe(true)
    }
  })

  it('keeps formal stroke-like residue tests outside stroke correctness authority', () => {
    const inspector = loadInspectorData()
    const specAnchors = readSpecAnchors()
    const stepIds = new Set(inspector.steps.map((step) => step.id))
    const routeIds = new Set(
      inspector.conditionalRoutes.map((route) => route.id)
    )
    const residueFiles = formalStrokeTestResidueRecords
      .map((record) => record.filePath)
      .sort()

    expect(inspector.inspectorContractErrors).toEqual([])
    expect(residueFiles).toEqual(getOutsideStrokeLikeFormalTestFiles())

    for (const record of formalStrokeTestResidueRecords) {
      expect(
        existsSync(resolve(repoRoot, record.filePath)),
        record.filePath
      ).toBe(true)
      expect(isStrokeGateTest(record.filePath), record.filePath).toBe(false)
      expect(record.shouldEnterStrokeCorrectnessGate, record.filePath).toBe(
        false
      )
      expect(record.definesStrokeSemantics, record.filePath).toBe(false)
      expect(record.requiredActionBeforePromotion, record.filePath).toBeTruthy()

      if (record.requiresSpecInspectorMapping) {
        expect(record.specRuleRefs.length, record.filePath).toBeGreaterThan(0)
        expect(
          record.inspectorStepRefs.length,
          record.filePath
        ).toBeGreaterThan(0)
        expect(
          record.inspectorRouteRefs.length,
          record.filePath
        ).toBeGreaterThan(0)
      } else {
        expect(record.specRuleRefs, record.filePath).toEqual([])
        expect(record.inspectorStepRefs, record.filePath).toEqual([])
        expect(record.inspectorRouteRefs, record.filePath).toEqual([])
      }

      for (const specRef of record.specRuleRefs) {
        const { filePath, fragment } = splitRef(specRef)
        expect(filePath, specRef).toBe(
          'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md'
        )
        expect(specAnchors.has(fragment), specRef).toBe(true)
      }
      for (const stepId of record.inspectorStepRefs) {
        expect(stepIds.has(stepId), `${record.filePath}:${stepId}`).toBe(true)
      }
      for (const routeId of record.inspectorRouteRefs) {
        expect(routeIds.has(routeId), `${record.filePath}:${routeId}`).toBe(
          true
        )
      }
    }
  })

  it('documents spec and inspector conformance for current stroke gates', () => {
    const plan = readFileSync(plansPath, 'utf8')
    const spec = readFileSync(specPath, 'utf8')
    const inspector = readFileSync(inspectorPath, 'utf8')

    expect(plan).toContain('Stroke Test Conformance Policy')
    expect(spec).toContain('Stroke Test Architecture')
    expect(spec).toContain('test:stroke:new')
    expect(inspector).toContain('testConformancePolicy')
  })
})
