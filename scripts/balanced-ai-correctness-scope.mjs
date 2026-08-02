import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const EXACT_PATHS = new Set([
  '.github/workflows/e2e.yml',
  'apps/asyra-design/app-environment.mjs',
  'apps/asyra-design/collaboration-server.ts',
  'apps/asyra-design/e2e/conversational-ai.spec.ts',
  'apps/asyra-design/e2e/test-utils.ts',
  'apps/asyra-design/package.json',
  'apps/asyra-design/playwright.config.ts',
  'apps/asyra-design/playwright-runtime-policy.mjs',
  'apps/asyra-design/vtracer-tool-server.mjs',
  'package.json',
  'scripts/balanced-ai-correctness-scope.mjs',
  'scripts/run-e2e.sh',
  'yarn.lock'
])

const PATH_PREFIXES = [
  'apps/asyra-design/src/ai/',
  'apps/asyra-design/src/app/',
  'apps/asyra-design/src/collaboration/',
  'apps/asyra-design/src/common-apis/',
  'apps/asyra-design/src/features/ai-agent/',
  'apps/asyra-design/src/init/',
  'apps/asyra-design/src/providers/',
  'apps/asyra-design/src/render-app/',
  'packages/ai-agent-runtime/',
  'packages/collaboration/',
  'packages/core/',
  'packages/factory/',
  'packages/feature-system/',
  'packages/persistence/',
  'packages/preset/',
  'packages/props-manager/',
  'packages/reactive-events/',
  'packages/render/',
  'packages/render-engine/',
  'packages/render-engine-pixi/',
  'packages/scene-tree/'
]

const normalizeRepositoryPath = (filePath) =>
  String(filePath)
    .trim()
    .replaceAll('\\', '/')
    .replace(/^\.\/+/, '')

export const isBalancedAiCorrectnessPath = (filePath) => {
  const normalized = normalizeRepositoryPath(filePath)
  return (
    EXACT_PATHS.has(normalized) ||
    PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  )
}

export const resolveBalancedAiCorrectnessScope = ({
  changedPaths,
  eventName,
  manualRequested
}) => {
  if (eventName === 'workflow_dispatch') {
    return manualRequested
  }
  if (eventName !== 'pull_request') {
    return false
  }
  return changedPaths.some(isBalancedAiCorrectnessPath)
}

const changedPathsBetween = (baseSha, headSha) => {
  if (!baseSha || !headSha) {
    throw new Error(
      'Pull-request balanced AI scope requires both base and head SHAs.'
    )
  }
  const result = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=ACMRDT', `${baseSha}...${headSha}`],
    {
      encoding: 'utf8'
    }
  )
  if (result.status !== 0) {
    throw new Error(
      `Unable to resolve balanced AI changed paths: ${result.stderr.trim()}`
    )
  }
  return result.stdout.split(/\r?\n/).filter(Boolean)
}

const isMainModule =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])

if (isMainModule) {
  const eventName = process.env.GITHUB_EVENT_NAME ?? ''
  const changedPaths =
    eventName === 'pull_request'
      ? changedPathsBetween(
          process.env.ASYRA_E2E_BASE_SHA,
          process.env.ASYRA_E2E_HEAD_SHA
        )
      : []
  const runBalancedAiCorrectness = resolveBalancedAiCorrectnessScope({
    changedPaths,
    eventName,
    manualRequested:
      process.env.ASYRA_E2E_MANUAL_BALANCED_AI_CORRECTNESS === 'true'
  })
  process.stdout.write(
    `run_balanced_ai_correctness=${runBalancedAiCorrectness ? '1' : '0'}\n`
  )
}
