module.exports = Object.freeze({
  discoveryRoots: Object.freeze(['tools/flow-inspector/inspectors']),
  exclusions: Object.freeze([
    Object.freeze({
      path: 'tools/flow-inspector/inspectors/asyra-executable-examples-flow-inspector.data.cjs',
      reason: 'superseded-and-removed-current-surface'
    }),
    Object.freeze({
      path: 'tools/flow-inspector/inspectors/asyra-website-visual-reimagine-flow-inspector.data.cjs',
      reason: 'replaced-historical-visual-direction'
    })
  ]),
  groupOverrides: Object.freeze({
    'flow-inspector-core-proof': Object.freeze({
      group: 'Tools',
      subgroup: 'Flow Inspector'
    }),
    'asyra-design-ai-conversational-drawing-performance': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
    'asyra-design-group-context-menu': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
    'asyra-design-group-interaction-mvp': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
    'asyra-design-layer-tree-reparent-reorder': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
    'asyra-design-socket-authoritative-document-persistence': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
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
    'flow-inspector-static-workspace': Object.freeze({
      group: 'Tools',
      subgroup: 'Flow Inspector'
    }),
    'node-24-runtime-upgrade': Object.freeze({
      group: 'Release',
      subgroup: 'Runtime Prerequisite'
    }),
    'remote-subtree-restore-snapshot': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
    stroke: Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    }),
    'vector-render-geometry-cache-transform': Object.freeze({
      group: 'Apps',
      subgroup: 'Asyra Design'
    })
  })
})
