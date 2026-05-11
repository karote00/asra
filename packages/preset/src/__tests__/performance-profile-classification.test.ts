import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))

const collectTestFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? collectTestFiles(path) : [path]
  })

const PROFILE_FILE_PATTERN = /(performance|profile).*\.test\.ts$/
const FAKE_RENDERER_PATTERNS = [
  /Recording[A-Za-z]*Graphic/,
  /HTMLCanvasElement\.prototype\.getContext/,
  /renderStrategyRegistry\.get\(/,
  /new Container\(/,
  /renderSolidCenterStrokeEntries\(/
]
const CPU_ONLY_MARKER_GROUPS = [
  [
    /measurementScope:\s*PERFORMANCE_MEASUREMENT_SCOPE/,
    /measurementScope:\s*['"]cpu-only['"]/
  ],
  [/rendererCoverage:\s*RENDERER_COVERAGE/, /rendererCoverage:\s*['"]fake['"]/],
  [
    /doesNotMeasureRenderer:\s*DOES_NOT_MEASURE_RENDERER/,
    /doesNotMeasureRenderer:\s*true/
  ]
]
const UX_CLAIM_PATTERN = /\b(?:120fps|FPS|UX|frame budget)\b/i

describe('performance profile classification', () => {
  it('should mark fake-renderer performance profiles as CPU-only and avoid UX claims', () => {
    const profileFiles = collectTestFiles(TEST_DIR).filter((file) =>
      PROFILE_FILE_PATTERN.test(file)
    )

    const violations = profileFiles.flatMap((file) => {
      const source = readFileSync(file, 'utf8')
      const usesFakeRenderer = FAKE_RENDERER_PATTERNS.some((pattern) =>
        pattern.test(source)
      )
      if (!usesFakeRenderer) {
        return []
      }

      const missingMarkers = CPU_ONLY_MARKER_GROUPS.filter(
        (patterns) => !patterns.some((pattern) => pattern.test(source))
      ).map(
        (patterns) =>
          `missing one of ${patterns.map((pattern) => pattern.source).join(' | ')}`
      )
      const uxClaims = UX_CLAIM_PATTERN.test(source)
        ? ['fake renderer profile contains UX/FPS language']
        : []

      return [...missingMarkers, ...uxClaims].map(
        (reason) => `${file}: ${reason}`
      )
    })

    expect(violations).toEqual([])
  })
})
