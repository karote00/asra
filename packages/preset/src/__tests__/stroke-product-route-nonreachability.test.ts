import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
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
const isTextFile = (path: string) =>
  path.endsWith('.ts') ||
  path.endsWith('.tsx') ||
  path.endsWith('.js') ||
  path.endsWith('.md')
const collectFiles = (path: string): string[] => {
  const absolutePath = join(repoRoot, path)
  const stats = statSync(absolutePath)
  if (stats.isFile()) {
    return isTextFile(path) ? [path] : []
  }
  return readdirSync(absolutePath).flatMap((entry) => {
    const childPath = `${path}/${entry}`
    if (
      childPath.includes('/artifacts/') ||
      childPath.includes('/decisions/') ||
      childPath.includes('/completed/')
    ) {
      return []
    }
    return collectFiles(childPath)
  })
}

const ACTIVE_PRODUCT_FILES = [
  'apps/asyra-design/src/common-apis/element/vector-apis.ts',
  'packages/preset/src/components/vector.ts',
  'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts',
  'packages/preset/src/components/stroke-render/constrained-dashed-domain-geometry.ts',
  'packages/preset/src/components/stroke-render/constrained-domain-stroke-geometry.ts',
  'packages/preset/src/components/stroke-render/stroke-domain-plan.ts',
  'packages/preset/src/components/stroke-render/stroke-final-face.ts',
  'packages/preset/src/components/stroke-render/stroke-region-packet.ts',
  'packages/preset/src/components/stroke-render/stroke-dirty-keys.ts',
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
const ACTIVE_RENDER_PRODUCT_FILES = ACTIVE_PRODUCT_FILES.filter(
  (path) => !path.includes('common-apis/element/vector-apis.ts')
)
const ACTIVE_STROKE_CONTRACT_FILES = [
  ...ACTIVE_PRODUCT_FILES,
  'packages/preset/src/components/oval.ts',
  'packages/preset/src/components/rectangle.ts',
  ...collectFiles('packages/preset/src/components/stroke-render'),
  ...collectFiles('packages/preset/src/__tests__'),
  ...collectFiles('apps/asyra-design/e2e'),
  'docs/ai/apps/asyra-design/PLANS.md',
  'docs/ai/apps/asyra-design/STROKE_CANONICAL_VISUAL_REVIEW.md',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js',
  ...collectFiles('docs/ai/apps/asyra-design/rules'),
  ...collectFiles('docs/ai/apps/asyra-design/features')
]
const REMOVED_PRODUCT_WORDING = [
  ['stroke', 'candidate', 'flow'].join('-'),
  ['center', 'equivalent'].join('-'),
  ['nat', 'ive', 'center'].join('-'),
  ['local', 'side'].join('-'),
  ['direct', 'local', 'side', 'exact'].join('-'),
  ['shouldUseVectorTopology', 'ObsoleteRoute'].join(''),
  ['vector-api-operation-', 'fall', 'back-count'].join(''),
  ['fall', 'back'].join(''),
  ['unsup', 'ported'].join('')
]
const REMOVED_PRODUCT_FLAGS = [['omit', 'Diagnostic', 'Metadata'].join('')]
const REMOVED_DRAG_PRODUCT_ROUTE_WORDING = [
  ['shouldSkip', 'Center'].join(''),
  ['visible', 'packet', 'skip'].join('-'),
  ['drag', 'visual'].join('-'),
  ['mouse', 'Dragging'].join('')
]
const REMOVED_PRODUCT_DOMAIN_MODE_WORDING = [
  ['diagnostic', 'no', 'product'].join('-')
]
const REMOVED_PRODUCT_RENDER_BRANCH_WORDING = [
  ['visual', 'Only'].join(''),
  ['debug', 'raw'].join('-')
]
const REMOVED_CONSTRAINED_DASHED_PRODUCT_COLLAPSE_WORDING = [
  ['constrained', 'dashed', 'product', 'union'].join('-'),
  ['product', 'coverage', 'union'].join('-'),
  ['constrained', 'dashed', 'product', 'coverage'].join('-'),
  ['get', 'Constrained', 'Dashed', 'Product', 'Render', 'Group', 'Key'].join(
    ''
  ),
  ['get', 'Constrained', 'Dashed', 'Product', 'Coverage', 'Group', 'Key'].join(
    ''
  ),
  ['build', 'Constrained', 'Dashed', 'Product', 'Render', 'Entry'].join(''),
  [
    'build',
    'Constrained',
    'Dashed',
    'Product',
    'Coverage',
    'Render',
    'Entry'
  ].join('')
]
const REMOVED_LOCAL_DOMAIN_ROUTING_WORDING = [
  ['should', 'Use', 'Constrained', 'Domain', 'Plan', 'For', 'Network'].join(''),
  ['get', 'Renderable', 'Strokes', 'For', 'Domain', 'Plan', 'Network'].join('')
]
const REMOVED_CONSTRAINED_DASHED_SPECIAL_ROUTE_WORDING = [
  ['shouldRender', 'Open', 'Source', 'Span', 'As', 'Both', 'Sides'].join(''),
  ['should', 'Keep', 'Constrained', 'Dashed', 'Packet', 'Local'].join(''),
  ['should', 'Defer', 'Constrained', 'Dashed', 'Exact', 'Arrangement'].join(''),
  'canUseInsideDashedFillClipSourceDomain',
  'inside-dashed-fill-clip-uses-source-path-intervals'
]
const REMOVED_CONSTRAINED_DASHED_DOMAIN_MODE_PROMOTION_WORDING = [
  'domainPlanDomainMode ?? strokeDomainPlan.domainMode ?? baseDomainMode',
  'domainPlanDomainMode ?? strokeDomainPlan.domainMode',
  'strokeDomainPlan.domainMode ?? baseDomainMode',
  "strokeDomainPlan.domainMode ?? 'closed-constrained-domain'"
]
const REMOVED_CONSTRAINED_DASHED_PROMOTION_WORDING = [
  ['constrained', 'dashed', 'candidates'].join(' '),
  ['constrained', 'dashed', 'acceptance'].join(' '),
  ['constrained', 'dashed', 'promotion'].join(' '),
  ['Constrained', 'Dashed', 'Promotion', 'Result'].join(''),
  [
    'promote',
    'Constrained',
    'Dashed',
    'Packets',
    'To',
    'Exact',
    'Arrangement'
  ].join(''),
  ['classify', 'Constrained', 'Dashed', 'Runtime', 'Status'].join(''),
  ['classify', 'Constrained', 'Dashed', 'Source'].join(''),
  ['classify', 'Constrained', 'Dashed', 'Interval'].join('')
]
const REMOVED_ACCEPTANCE_METADATA_WORDING = [
  ['runtime', 'Status'].join(''),
  ['runtime', 'Reason'].join('')
]
const REMOVED_SOURCE_FAMILY_ROUTE_WORDING = [
  ['sup', 'port', 'State'].join(''),
  ['block', 'ed', 'Reason'].join(''),
  ['simple', 'open', 'unbounded'].join('-')
]
const REMOVED_PRODUCT_METADATA_WORDING = [
  ['geometry', 'Family'].join(''),
  ['resolution', 'Status'].join(''),
  ['source', 'Topology'].join(''),
  ['interval', 'Topology'].join(''),
  ['ownership', 'Status'].join(''),
  ['runtime', 'Status'].join(''),
  ['runtime', 'Reason'].join(''),
  ['visual', 'Only'].join(''),
  ['drag', 'visual'].join('-'),
  ['native', 'center'].join('-'),
  ['center', 'equivalent'].join('-'),
  ['fall', 'back'].join(''),
  ['unsup', 'ported'].join(''),
  ['topology', 'Classification', 'Revision'].join(''),
  ['source', 'Family', 'Revision'].join(''),
  ['source', 'Topology', 'Revision'].join('')
]
const FORMAL_STROKE_DOMAIN_MODES = [
  'center-product',
  'closed-constrained-domain',
  'open-contour-constrained-domain',
  'open-dangling-outside-both-sides',
  'inside-excluded-open-span'
]
const STROKE_DOMAIN_PLAN_FILE =
  'packages/preset/src/components/stroke-render/stroke-domain-plan.ts'
const STROKE_DOMAIN_AUTHORITY_FILES = [
  'docs/ai/apps/asyra-design/PLANS.md',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/README.md',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-flow-inspector.data.js',
  'docs/ai/apps/asyra-design/plans/stroke-engine-final/stroke-cleanup-manifest.md'
]

const getStrokeDomainModeUnionValues = (text: string) => {
  const match = text.match(
    /export type StrokeDomainMode =(?<body>[\s\S]*?)\n\n/
  )
  const body = match?.groups?.body ?? ''
  return Array.from(body.matchAll(/\| '([^']+)'/g))
    .map((entry) => entry[1])
    .sort()
}

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

  it('should not run: let diagnostic detail flags affect stroke product geometry', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_PRODUCT_FLAGS.forEach((flag) => {
        expect(text, `${path}:${flag}`).not.toContain(flag)
      })
    })
  })

  it('should not run: let drag state select a product-visible stroke route', () => {
    ACTIVE_RENDER_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_DRAG_PRODUCT_ROUTE_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: encode diagnostic or debug-only state as a product domain mode', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_PRODUCT_DOMAIN_MODE_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: expose diagnostic render branches as product route conditions', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_PRODUCT_RENDER_BRANCH_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: collapse constrained dashed product intervals into a render union route', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_CONSTRAINED_DASHED_PRODUCT_COLLAPSE_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: route constrained product locally before the domain plan', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_LOCAL_DOMAIN_ROUTING_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: keep constrained dashed special product branches alive', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_CONSTRAINED_DASHED_SPECIAL_ROUTE_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: promote missing interval domain modes to visible constrained dashed products', () => {
    const text = read(
      'packages/preset/src/components/stroke-render/constrained-dashed-stroke-packets.ts'
    )

    REMOVED_CONSTRAINED_DASHED_DOMAIN_MODE_PROMOTION_WORDING.forEach(
      (wording) => {
        expect(text, wording).not.toContain(wording)
      }
    )
    expect(text).not.toMatch(/\bstrokeDomainPlan\.domainMode\s*\?\?/)
  })

  it('should not run: keep constrained dashed candidate or promotion routes alive', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_CONSTRAINED_DASHED_PROMOTION_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: keep acceptance metadata in active product code', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_ACCEPTANCE_METADATA_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: keep source-family legacy route semantics in active product code', () => {
    ACTIVE_PRODUCT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_SOURCE_FAMILY_ROUTE_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should not run: keep removed product metadata in active stroke product, tests, docs, or inspector contracts', () => {
    ACTIVE_STROKE_CONTRACT_FILES.forEach((path) => {
      const text = read(path)

      REMOVED_PRODUCT_METADATA_WORDING.forEach((wording) => {
        expect(text, `${path}:${wording}`).not.toContain(wording)
      })
    })
  })

  it('should run: keep authority formal stroke domain modes synchronized with runtime union', () => {
    const runtimeModes = getStrokeDomainModeUnionValues(
      read(STROKE_DOMAIN_PLAN_FILE)
    )

    expect(runtimeModes).toEqual([...FORMAL_STROKE_DOMAIN_MODES].sort())
    STROKE_DOMAIN_AUTHORITY_FILES.forEach((path) => {
      const text = read(path)
      FORMAL_STROKE_DOMAIN_MODES.forEach((mode) => {
        expect(text, `${path}:${mode}`).toContain(mode)
      })
    })
  })
})
