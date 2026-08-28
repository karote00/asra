const guideMappings = Object.freeze({
  'core-information-model': Object.freeze([
    'learn/information-models',
    'start/custom-composition'
  ]),
  'preset-2d-minimal': Object.freeze(['start/preset-2d']),
  'preset-selective-defaults': Object.freeze(['start/preset-2d']),
  'custom-component-schema': Object.freeze(['build/custom-schema']),
  'feature-session-undo': Object.freeze(['build/feature-session']),
  'app-versioned-load-migration': Object.freeze([
    'build/persistence-migration'
  ]),
  'custom-render-boundary': Object.freeze(['build/render-boundary']),
  'collaboration-two-memory-actors': Object.freeze(['build/collaboration']),
  'ai-registered-action': Object.freeze(['build/ai-actions']),
  'app-retrieval-action': Object.freeze(['build/app-retrieval-action']),
  'generated-design-app-extension': Object.freeze([
    'start/create-design-app',
    'start/extend-with-ai'
  ])
})

module.exports = Object.freeze({
  status: 'SUPERSEDED',
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/asyra-executable-examples-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-executable-examples-flow-inspector.data.cjs',
    documentationPlanPath:
      'docs/ai/framework/plans/completed/asyra-public-package-documentation-plan.md',
    websitePlanPath:
      'docs/ai/framework/plans/asyra-website-platform-and-docs-plan.md'
  }),
  guideMappings,
  currentOwners: Object.freeze({
    learning: 'docs/public',
    interactiveRuntime: 'apps/asyra-framework-site/app/atlas',
    packageVerification: 'package-owned formal tests',
    beginnerProduct: 'create-asyra-design-app and Asyra Design'
  }),
  removedSurfaces: Object.freeze([
    'public executable-example route',
    'repository example runner commands',
    'public example inventory',
    'source-linked example modules',
    'generated-app example fixture'
  ]),
  retainedContracts: Object.freeze([
    'Every retired subject maps to at least one maintained public guide.',
    'Advanced guides own copyable code, call location, owner flow, expected result, and failure or disabled behavior.',
    'Runtime Atlas links its six real interactive cases to advanced guides.',
    'Package and app behavior remains protected by owner-owned formal tests.',
    'Current browser/Core support stays distinct from future Headless Core and Core Kernel work.'
  ])
})
