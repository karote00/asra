/* eslint-disable @typescript-eslint/no-require-imports */

const freeze = (value) => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value))
    return value
  Object.values(value).forEach(freeze)
  return Object.freeze(value)
}

const data = {
  schema: { id: 'flow-inspector', version: 2 },
  target: {
    id: 'flow-inspector-static-workspace',
    kind: 'tool',
    title: 'Flow Inspector Static Workspace',
    subtitle:
      'Current-project Inspector discovery, isolated navigation, and static rendering'
  },
  authority: {
    specPath: 'docs/ai/tools/flow-inspector/STATIC_WORKSPACE.md',
    inspectorPath:
      'docs/ai/tools/flow-inspector/plans/flow-inspector-static-workspace-flow-inspector.data.cjs',
    semanticOwner: 'Flow Inspector Static Workspace Contract',
    inspectorOwner: 'Flow Inspector Tool'
  },
  links: [
    {
      id: 'static-workspace-contract',
      kind: 'authority',
      label: 'Static Workspace Contract',
      href: '../STATIC_WORKSPACE.md'
    },
    {
      id: 'static-workspace-plan',
      kind: 'plan',
      label: 'Static Workspace Preview Plan',
      href: './completed/flow-inspector-static-workspace-preview-plan.md'
    }
  ],
  lanes: [
    { id: 'authority', title: 'Authority and Catalog', order: 1 },
    { id: 'workspace', title: 'Workspace Navigation', order: 2 },
    { id: 'target', title: 'Isolated Target View', order: 3 },
    { id: 'verification', title: 'Static Verification', order: 4 }
  ],
  steps: [
    {
      id: 'discover-inspector-sources',
      order: 1,
      laneId: 'authority',
      title: 'Discover Inspector sources',
      ownerPackage: 'tools/flow-inspector/workspace',
      purpose:
        'Discover every fixed-root Inspector data candidate without interpreting target semantics.',
      inputs: ['fixed discovery roots', 'Inspector filename contract'],
      outputs: ['artifact:discovered-inspector-sources'],
      conditions: ['Each matching source path appears exactly once.'],
      bypasses: ['No root or filename candidate may be silently bypassed.'],
      allowedContributors: ['filesystem paths under the three fixed roots'],
      forbiddenContributors: ['runtime status', 'Git history heuristics'],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/workspace/generate-workspace.cjs',
        'tools/flow-inspector/workspace/__tests__/catalog.contract.test.cjs'
      ],
      specRefs: ['#discovery-input'],
      failureOwnerStepId: 'discover-inspector-sources'
    },
    {
      id: 'classify-workspace-catalog',
      order: 2,
      laneId: 'authority',
      title: 'Classify workspace catalog',
      ownerPackage: 'tools/flow-inspector/workspace',
      purpose:
        'Classify every discovery candidate as included or explicitly excluded and derive discovery-only metadata.',
      inputs: ['artifact:discovered-inspector-sources', 'catalog policy'],
      outputs: ['artifact:classified-workspace-catalog'],
      conditions: [
        'Every discovered candidate is classified once.',
        'Flow v2 ids equal target ids.'
      ],
      bypasses: ['Exclusion requires a stable catalog reason.'],
      allowedContributors: ['catalog policy', 'source-owned target metadata'],
      forbiddenContributors: ['duplicated target steps', 'execution status'],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/workspace/catalog.cjs',
        'tools/flow-inspector/workspace/generate-workspace.cjs',
        'tools/flow-inspector/workspace/__tests__/catalog.contract.test.cjs'
      ],
      specRefs: ['#catalog-contract'],
      failureOwnerStepId: 'classify-workspace-catalog'
    },
    {
      id: 'generate-browser-snapshot',
      order: 3,
      laneId: 'authority',
      title: 'Generate browser snapshot',
      ownerPackage: 'tools/flow-inspector/workspace',
      purpose:
        'Produce a deterministic browser bundle whose serialized target data exactly matches classified source objects.',
      inputs: ['artifact:classified-workspace-catalog'],
      outputs: ['artifact:workspace-browser-snapshot'],
      conditions: ['Generated output is deterministic and JSON-safe.'],
      bypasses: ['No authored semantic copy may replace source serialization.'],
      allowedContributors: ['classified catalog', 'source data objects'],
      forbiddenContributors: ['hand-authored target semantics'],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/workspace/generate-workspace.cjs',
        'tools/flow-inspector/workspace/workspace-bundle.data.js',
        'tools/flow-inspector/workspace/__tests__/catalog.contract.test.cjs'
      ],
      specRefs: ['#catalog-contract'],
      failureOwnerStepId: 'generate-browser-snapshot'
    },
    {
      id: 'route-workspace-selection',
      order: 4,
      laneId: 'workspace',
      title: 'Route workspace selection',
      ownerPackage: 'tools/flow-inspector/workspace',
      purpose:
        'Render Overview and sidebar navigation, then resolve selection through one stable hash route.',
      inputs: ['artifact:workspace-browser-snapshot', 'location hash'],
      outputs: ['artifact:selected-workspace-route'],
      conditions: ['Known ids select exactly one entry.'],
      bypasses: ['Missing hash selects Overview only.'],
      allowedContributors: ['catalog summaries', 'browser location'],
      forbiddenContributors: [
        'target semantic reconstruction',
        'runtime health'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/workspace/workspace.html',
        'tools/flow-inspector/src/App.tsx',
        'tools/flow-inspector/src/main.tsx',
        'tools/flow-inspector/src/routing.ts',
        'tools/flow-inspector/src/types.ts',
        'tools/flow-inspector/src/workspace.css',
        'tools/flow-inspector/src/__tests__/workspace.test.tsx'
      ],
      specRefs: ['#routing-and-isolation', '#supported-behavior'],
      failureOwnerStepId: 'route-workspace-selection'
    },
    {
      id: 'isolate-selected-target',
      order: 5,
      laneId: 'target',
      title: 'Isolate selected target',
      ownerPackage: 'tools/flow-inspector/workspace',
      purpose:
        'Navigate a dedicated target iframe so every selection receives a fresh document and global scope.',
      inputs: ['artifact:selected-workspace-route'],
      outputs: ['artifact:isolated-target-document'],
      conditions: [
        'Selected id resolves to one included bundle entry.',
        'Target query and hash ids match before rendering.'
      ],
      bypasses: ['Overview creates no target document.'],
      allowedContributors: ['selected catalog entry', 'target iframe'],
      forbiddenContributors: [
        'parent DOM as target authority',
        'previous target globals'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/src/App.tsx',
        'tools/flow-inspector/src/routing.ts',
        'tools/flow-inspector/workspace/target.html',
        'tools/flow-inspector/workspace/target.js',
        'tools/flow-inspector/src/__tests__/workspace.test.tsx',
        'tools/flow-inspector/workspace/__tests__/workspace.test.cjs'
      ],
      specRefs: ['#routing-and-isolation'],
      failureOwnerStepId: 'isolate-selected-target'
    },
    {
      id: 'render-selected-contract',
      order: 6,
      laneId: 'target',
      title: 'Render selected contract',
      ownerPackage: 'tools/flow-inspector',
      purpose:
        'Render v2 targets with the shared viewer and label legacy compatibility data without inventing semantics.',
      inputs: [
        'artifact:isolated-target-document',
        'artifact:workspace-browser-snapshot'
      ],
      outputs: ['artifact:rendered-static-inspector'],
      conditions: ['Renderer kind follows catalog classification.'],
      bypasses: [
        'Invalid targets render an explicit error instead of fallback.'
      ],
      allowedContributors: ['shared v2 renderer', 'legacy read-only renderer'],
      forbiddenContributors: ['schema coercion', 'execution state'],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/viewer.js',
        'tools/flow-inspector/viewer.css',
        'tools/flow-inspector/workspace/legacy-viewer.js',
        'tools/flow-inspector/workspace/target.js',
        'tools/flow-inspector/workspace/__tests__/workspace.test.cjs'
      ],
      specRefs: ['#ownership', '#supported-behavior', '#unsupported-behavior'],
      failureOwnerStepId: 'render-selected-contract'
    },
    {
      id: 'preserve-standalone-entries',
      order: 7,
      laneId: 'verification',
      title: 'Preserve standalone entries',
      ownerPackage: 'tools/flow-inspector',
      purpose:
        'Keep existing target HTML entries directly openable and synchronized with the shared renderer.',
      inputs: ['artifact:rendered-static-inspector'],
      outputs: ['artifact:standalone-compatibility-proof'],
      conditions: ['Every retained standalone entry passes its existing gate.'],
      bypasses: [
        'A source without an existing standalone entry creates no compatibility claim.'
      ],
      allowedContributors: ['existing target HTML', 'shared snapshot embedder'],
      forbiddenContributors: ['workspace dependency in standalone entries'],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/embed-viewer.cjs',
        'tools/flow-inspector/__tests__/viewer-entry.test.cjs'
      ],
      specRefs: ['#definition-of-done'],
      failureOwnerStepId: 'preserve-standalone-entries'
    },
    {
      id: 'verify-static-preview',
      order: 8,
      laneId: 'verification',
      title: 'Verify static preview',
      ownerPackage: 'tools/flow-inspector/workspace',
      purpose:
        'Prove complete catalog integration, static behavior, responsive usability, and truthful preview scope.',
      inputs: [
        'artifact:workspace-browser-snapshot',
        'artifact:rendered-static-inspector',
        'artifact:standalone-compatibility-proof'
      ],
      outputs: ['artifact:verified-static-workspace-preview'],
      conditions: ['All product cases and Definition of Done gates pass.'],
      bypasses: ['No dynamic Control Plane gate is part of this preview.'],
      allowedContributors: ['formal tests', 'synchronized browser review'],
      forbiddenContributors: [
        'manual-only completion claim',
        'future feature claims'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/workspace/__tests__/catalog.contract.test.cjs',
        'tools/flow-inspector/workspace/__tests__/workspace.test.cjs',
        'tools/flow-inspector/src/__tests__/workspace.test.tsx',
        'tools/flow-inspector/tsconfig.json',
        'tools/flow-inspector/package.json',
        'tools/flow-inspector/vite.config.ts',
        'tools/flow-inspector/vitest.config.ts',
        'tools/flow-inspector/workspace/generated/flow-inspector-workspace.js',
        'tools/flow-inspector/workspace/generated/flow-inspector-workspace.css',
        'package.json',
        'turbo.json',
        'yarn.lock',
        'docs/ai/tools/flow-inspector/STATIC_WORKSPACE.md',
        'docs/ai/tools/flow-inspector/README.md'
      ],
      specRefs: ['#product-cases', '#definition-of-done'],
      failureOwnerStepId: 'verify-static-preview'
    }
  ],
  routes: [
    {
      id: 'discovery-to-classification',
      from: 'discover-inspector-sources',
      to: 'classify-workspace-catalog',
      kind: 'required',
      predicate: 'all fixed-root candidates discovered',
      producedArtifacts: ['artifact:discovered-inspector-sources']
    },
    {
      id: 'classification-to-generation',
      from: 'classify-workspace-catalog',
      to: 'generate-browser-snapshot',
      kind: 'required',
      predicate: 'every candidate classified once',
      producedArtifacts: ['artifact:classified-workspace-catalog']
    },
    {
      id: 'generation-to-routing',
      from: 'generate-browser-snapshot',
      to: 'route-workspace-selection',
      kind: 'required',
      predicate: 'browser snapshot matches sources',
      producedArtifacts: ['artifact:workspace-browser-snapshot']
    },
    {
      id: 'generation-to-render',
      from: 'generate-browser-snapshot',
      to: 'render-selected-contract',
      kind: 'selected-target-data',
      predicate: 'selected included entry exists in the browser snapshot',
      producedArtifacts: ['artifact:workspace-browser-snapshot']
    },
    {
      id: 'generation-to-preview-verification',
      from: 'generate-browser-snapshot',
      to: 'verify-static-preview',
      kind: 'verification',
      predicate: 'complete generated snapshot enters final verification',
      producedArtifacts: ['artifact:workspace-browser-snapshot']
    },
    {
      id: 'routing-to-isolation',
      from: 'route-workspace-selection',
      to: 'isolate-selected-target',
      kind: 'selected-target',
      predicate: 'route contains a known included id',
      producedArtifacts: ['artifact:selected-workspace-route']
    },
    {
      id: 'isolation-to-render',
      from: 'isolate-selected-target',
      to: 'render-selected-contract',
      kind: 'required',
      predicate: 'isolated target document resolves selected bundle entry',
      producedArtifacts: ['artifact:isolated-target-document']
    },
    {
      id: 'render-to-standalone-proof',
      from: 'render-selected-contract',
      to: 'preserve-standalone-entries',
      kind: 'compatibility',
      predicate: 'selected source owns an existing standalone entry',
      producedArtifacts: ['artifact:rendered-static-inspector']
    },
    {
      id: 'render-to-preview-verification',
      from: 'render-selected-contract',
      to: 'verify-static-preview',
      kind: 'required',
      predicate: 'selected renderer completes without contract error',
      producedArtifacts: ['artifact:rendered-static-inspector']
    },
    {
      id: 'standalone-proof-to-preview-verification',
      from: 'preserve-standalone-entries',
      to: 'verify-static-preview',
      kind: 'required',
      predicate: 'retained standalone entries remain independent',
      producedArtifacts: ['artifact:standalone-compatibility-proof']
    },
    {
      id: 'preview-verified',
      from: 'verify-static-preview',
      kind: 'terminal',
      predicate: 'all static preview gates pass',
      producedArtifacts: ['artifact:verified-static-workspace-preview']
    }
  ],
  artifacts: [
    {
      id: 'artifact:discovered-inspector-sources',
      ownerStepId: 'discover-inspector-sources',
      channel: 'generator memory',
      consumerStepIds: ['classify-workspace-catalog'],
      terminal: false
    },
    {
      id: 'artifact:classified-workspace-catalog',
      ownerStepId: 'classify-workspace-catalog',
      channel: 'validated catalog',
      consumerStepIds: ['generate-browser-snapshot'],
      terminal: false
    },
    {
      id: 'artifact:workspace-browser-snapshot',
      ownerStepId: 'generate-browser-snapshot',
      channel: 'generated JavaScript',
      consumerStepIds: [
        'route-workspace-selection',
        'render-selected-contract',
        'verify-static-preview'
      ],
      terminal: false
    },
    {
      id: 'artifact:selected-workspace-route',
      ownerStepId: 'route-workspace-selection',
      channel: 'location hash',
      consumerStepIds: ['isolate-selected-target'],
      terminal: false
    },
    {
      id: 'artifact:isolated-target-document',
      ownerStepId: 'isolate-selected-target',
      channel: 'iframe navigation',
      consumerStepIds: ['render-selected-contract'],
      terminal: false
    },
    {
      id: 'artifact:rendered-static-inspector',
      ownerStepId: 'render-selected-contract',
      channel: 'isolated DOM',
      consumerStepIds: ['preserve-standalone-entries', 'verify-static-preview'],
      terminal: false
    },
    {
      id: 'artifact:standalone-compatibility-proof',
      ownerStepId: 'preserve-standalone-entries',
      channel: 'formal test result',
      consumerStepIds: ['verify-static-preview'],
      terminal: false
    },
    {
      id: 'artifact:verified-static-workspace-preview',
      ownerStepId: 'verify-static-preview',
      channel: 'preview acceptance',
      consumerStepIds: [],
      terminal: true
    }
  ],
  invariants: [
    {
      id: 'catalog-does-not-own-target-semantics',
      statement:
        'Catalog metadata never duplicates target steps, routes, artifacts, invariants, or acceptance semantics.',
      stepIds: ['classify-workspace-catalog', 'generate-browser-snapshot'],
      artifactIds: [
        'artifact:classified-workspace-catalog',
        'artifact:workspace-browser-snapshot'
      ],
      specRefs: ['#catalog-contract']
    },
    {
      id: 'selection-is-document-isolated',
      statement:
        'Every selected target renders in a fresh iframe document and cannot retain the previous target global or DOM.',
      stepIds: [
        'route-workspace-selection',
        'isolate-selected-target',
        'render-selected-contract'
      ],
      artifactIds: [
        'artifact:selected-workspace-route',
        'artifact:isolated-target-document',
        'artifact:rendered-static-inspector'
      ],
      specRefs: ['#routing-and-isolation']
    },
    {
      id: 'workspace-remains-static',
      statement:
        'The preview exposes no execution status, CI decision, command, action, or mutation path.',
      stepIds: [
        'route-workspace-selection',
        'render-selected-contract',
        'verify-static-preview'
      ],
      artifactIds: ['artifact:verified-static-workspace-preview'],
      specRefs: ['#unsupported-behavior']
    }
  ],
  acceptanceContracts: [
    {
      id: 'complete-current-catalog',
      assertions: [
        'Every fixed-root Inspector candidate is included or excluded exactly once with a stable reason.'
      ],
      stepIds: [
        'discover-inspector-sources',
        'classify-workspace-catalog',
        'generate-browser-snapshot'
      ],
      specRefs: ['#discovery-input', '#definition-of-done']
    },
    {
      id: 'single-static-workspace',
      assertions: [
        'Sidebar navigation, search, deep links, reload restoration, and selected target rendering work in one directly openable workspace.'
      ],
      stepIds: [
        'route-workspace-selection',
        'isolate-selected-target',
        'render-selected-contract'
      ],
      specRefs: ['#supported-behavior', '#product-cases']
    },
    {
      id: 'preview-release-ready',
      assertions: [
        'All static integration, standalone compatibility, and synchronized browser gates pass without dynamic Control Plane claims.'
      ],
      stepIds: ['preserve-standalone-entries', 'verify-static-preview'],
      specRefs: ['#definition-of-done']
    }
  ]
}

module.exports = freeze(data)
