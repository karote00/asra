module.exports = Object.freeze({
  discoveryRoots: Object.freeze([
    'docs/ai/framework/plans',
    'docs/ai/apps',
    'docs/ai/tools'
  ]),
  exclusions: Object.freeze([
    Object.freeze({
      path: 'docs/ai/framework/plans/asyra-executable-examples-flow-inspector.data.cjs',
      reason: 'superseded-and-removed-current-surface'
    }),
    Object.freeze({
      path: 'docs/ai/framework/plans/asyra-website-visual-reimagine-flow-inspector.data.cjs',
      reason: 'replaced-historical-visual-direction'
    })
  ]),
  groupOverrides: Object.freeze({
    'create-asyra-design-app-release': Object.freeze({
      group: 'Release',
      subgroup: 'CLI and Generated App'
    }),
    'framework-package-release': Object.freeze({
      group: 'Release',
      subgroup: 'Framework Packages'
    }),
    'framework-release-readiness': Object.freeze({
      group: 'Release',
      subgroup: 'Framework Readiness'
    }),
    'node-24-runtime-upgrade': Object.freeze({
      group: 'Release',
      subgroup: 'Runtime Prerequisite'
    })
  })
})
