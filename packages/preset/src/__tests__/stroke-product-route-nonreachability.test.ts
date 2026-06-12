import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  '..',
  '..'
)

const read = (path: string) => readFileSync(join(repoRoot, path), 'utf8')

const ACTIVE_PRODUCT_FILES = [
  'apps/asyra-design/src/common-apis/element/vector-apis.ts',
  'packages/preset/src/components/vector.ts',
  'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
  'packages/preset/src/components/stroke-render/constrained-dashed-domain-geometry.ts',
  'packages/preset/src/components/stroke-render/constrained-domain-stroke-geometry.ts',
  'packages/preset/src/components/stroke-render/stroke-domain-plan.ts',
  'packages/preset/src/components/stroke-render/resolved-source-family.ts',
  'packages/preset/src/components/stroke-render/constrained-solid-stroke-packets.ts',
  'packages/preset/src/components/stroke-render/solid-center-stroke-packets.ts',
  'packages/preset/src/components/stroke-render/solid-center-stroke-render.ts',
  'packages/preset/src/components/stroke-render/dashed-center-stroke-packets.ts',
  'packages/preset/src/components/stroke-render/stroke-candidate-arrangement.ts',
  'apps/asyra-design/e2e/definitions/constrained-dashed-stroke-visual.definition.md',
  'apps/asyra-design/e2e/definitions/dashed-center-stroke-visual.definition.md',
  'apps/asyra-design/e2e/definitions/solid-constrained-stroke-visual.definition.md',
  'docs/ai/apps/asyra-design/PLANS.md',
  'docs/ai/apps/asyra-design/STROKE_CANONICAL_VISUAL_REVIEW.md',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js'
]
const REMOVED_PRODUCT_WORDING = [
  ['stroke', 'candidate', 'flow'].join('-'),
  ['center', 'equivalent'].join('-'),
  ['simple', 'open', 'center', 'product'].join('-'),
  ['nat', 'ive', 'center'].join('-'),
  ['local', 'side'].join('-'),
  ['direct', 'local', 'side', 'exact'].join('-'),
  ['shouldUseVectorTopology', 'Fallback'].join(''),
  ['vector-api-operation-', 'fall', 'back-count'].join(''),
  ['fall', 'back'].join(''),
  ['un', 'supported'].join('')
]

describe('stroke product route non-reachability', () => {
  it('should not run: expose deleted product routing to active product code', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      expect(read(path), path).not.toContain(REMOVED_PRODUCT_WORDING[0])
    })
  })

  it('should not run: describe active product routes with removed historical wording', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_PRODUCT_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })
})
