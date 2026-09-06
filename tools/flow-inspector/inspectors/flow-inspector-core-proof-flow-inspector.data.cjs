const data = {
  schema: {
    id: 'flow-inspector',
    version: 2
  },
  target: {
    id: 'flow-inspector-core-proof',
    kind: 'tool',
    title: 'Flow Inspector Core Proof',
    subtitle: 'Two real Factory flows with controlled local verification'
  },
  authority: {
    specPath: 'docs/ai/tools/flow-inspector/CORE_PROOF.md',
    inspectorPath:
      'tools/flow-inspector/inspectors/flow-inspector-core-proof-flow-inspector.data.cjs',
    semanticOwner: 'Flow Inspector Core Proof',
    inspectorOwner: 'Flow Inspector Tool'
  },
  links: [
    {
      id: 'product-contract',
      kind: 'authority',
      label: 'Core Proof Contract',
      href: '../../../docs/ai/tools/flow-inspector/CORE_PROOF.md'
    }
  ],
  lanes: [
    {
      id: 'proof',
      title: 'Contract and Execution',
      order: 1
    },
    {
      id: 'interaction',
      title: 'Actions and Board',
      order: 2
    }
  ],
  steps: [
    {
      id: 'admit-proof-contract',
      order: 1,
      laneId: 'proof',
      title: 'Admit proof contract',
      ownerPackage: 'tools/flow-inspector/control-plane',
      purpose: 'Admission',
      inputs: ['product-owned proof manifest', 'target architecture Inspector'],
      outputs: ['artifact:admitted-proof-contract'],
      conditions: [
        'Every required case resolves to a concrete selected step; selected handoffs have explicit producers or declared external inputs.'
      ],
      bypasses: [
        'No missing, ambiguous, empty, or contradictory contract may be bypassed.'
      ],
      allowedContributors: [
        'packages/factory/flow-contracts.json',
        'tools/flow-inspector/inspectors/transaction-flow-inspector.data.cjs'
      ],
      forbiddenContributors: [
        'runtime result guessing',
        'UI-authored step semantics'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/control-plane/contracts.cjs',
        'tools/flow-inspector/control-plane/__tests__/contracts.test.cjs'
      ],
      specRefs: ['#admission'],
      failureOwnerStepId: 'admit-proof-contract'
    },
    {
      id: 'capture-proof-source',
      order: 2,
      laneId: 'proof',
      title: 'Capture proof source',
      ownerPackage: 'tools/flow-inspector/control-plane',
      purpose: 'Source and Evidence',
      inputs: [
        'artifact:admitted-proof-contract',
        'authorized run identity',
        'declared source roots and dependency metadata'
      ],
      outputs: ['artifact:proof-source-snapshot'],
      conditions: [
        'Copy regular source files into one attempt-owned tree, bind file bytes and Git metadata to a digest, and reject symlinks.'
      ],
      bypasses: [
        'No previous snapshot or mutable checkout may replace the captured runtime source.'
      ],
      allowedContributors: [
        'filesystem reads inside declared repository roots'
      ],
      forbiddenContributors: ['arbitrary paths', 'ambient secret files'],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/control-plane/snapshot.cjs',
        'tools/flow-inspector/control-plane/__tests__/snapshot.test.cjs'
      ],
      specRefs: ['#source-and-evidence'],
      failureOwnerStepId: 'capture-proof-source'
    },
    {
      id: 'execute-proof-run',
      order: 3,
      laneId: 'proof',
      title: 'Execute proof run',
      ownerPackage: 'tools/flow-inspector/control-plane',
      purpose: 'Controlled Actions and Retention',
      inputs: [
        'artifact:proof-source-snapshot',
        'registered scenario',
        'deadline and cancellation signal'
      ],
      outputs: ['artifact:proof-runner-result'],
      conditions: [
        'Run one registered Vitest process group against captured source; await settlement on success, error, deadline, or cancellation.'
      ],
      bypasses: [
        'Denied requests never reach execution; a process failure produces a non-passing runner result.'
      ],
      allowedContributors: [
        'installed Vitest',
        'product-owned Factory proof tests and negative transform'
      ],
      forbiddenContributors: [
        'shell command input',
        'source writes outside the attempt directory',
        'unbounded output'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/control-plane/runner.cjs',
        'tools/flow-inspector/control-plane/__tests__/runner.test.cjs'
      ],
      specRefs: ['#controlled-actions-and-retention'],
      failureOwnerStepId: 'execute-proof-run'
    },
    {
      id: 'assess-proof-evidence',
      order: 4,
      laneId: 'proof',
      title: 'Assess proof evidence',
      ownerPackage: 'tools/flow-inspector/control-plane',
      purpose: 'Source and Evidence',
      inputs: [
        'artifact:admitted-proof-contract',
        'artifact:proof-source-snapshot',
        'artifact:proof-runner-result'
      ],
      outputs: ['artifact:assessed-proof-evidence'],
      conditions: [
        'Exactly one passing observation per required case, successful exit, and no runner errors are necessary for pass; preserve observed step failures and source identity.'
      ],
      bypasses: [
        'Missing or invalid reports produce an explicit non-pass, never inferred completion.'
      ],
      allowedContributors: ['validated Vitest JSON result'],
      forbiddenContributors: [
        'test-file existence as behavioral evidence',
        'exit code alone'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/control-plane/evidence.cjs',
        'tools/flow-inspector/control-plane/__tests__/evidence.test.cjs'
      ],
      specRefs: ['#source-and-evidence'],
      failureOwnerStepId: 'assess-proof-evidence'
    },
    {
      id: 'serve-proof-actions',
      order: 5,
      laneId: 'interaction',
      title: 'Serve proof actions',
      ownerPackage: 'tools/flow-inspector/control-plane',
      purpose: 'Controlled Actions and Retention',
      inputs: [
        'artifact:admitted-proof-contract',
        'artifact:assessed-proof-evidence',
        'registered local request',
        'attempt store'
      ],
      outputs: ['artifact:proof-board-state'],
      conditions: [
        'Authorize before work, admit one run, durably record state with audit, and expose immutable snapshot-bound evidence; restart interrupts incomplete attempts.'
      ],
      bypasses: [
        'Unauthorized, conflicting, oversized, malformed, or unknown actions have no runner side effects.'
      ],
      allowedContributors: [
        'local CLI',
        'loopback HTTP capability',
        'atomic filesystem attempt records'
      ],
      forbiddenContributors: [
        'external providers',
        'arbitrary commands',
        'implicit current-source or deployment claims'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/control-plane/service.cjs',
        'tools/flow-inspector/control-plane/store.cjs',
        'tools/flow-inspector/control-plane/server.cjs',
        'tools/flow-inspector/control-plane/cli.cjs',
        'tools/flow-inspector/control-plane/__tests__/service.test.cjs',
        'tools/flow-inspector/control-plane/__tests__/store.test.cjs',
        'tools/flow-inspector/control-plane/__tests__/server.test.cjs'
      ],
      specRefs: ['#controlled-actions-and-retention'],
      failureOwnerStepId: 'serve-proof-actions'
    },
    {
      id: 'render-proof-board',
      order: 6,
      laneId: 'interaction',
      title: 'Render proof board',
      ownerPackage: 'tools/flow-inspector/control-plane',
      purpose: 'Board',
      inputs: ['artifact:proof-board-state', 'user-selected flow and scenario'],
      outputs: ['artifact:proof-board-view'],
      conditions: [
        'Render selected architecture steps and exact attempt results, run checks from cards, and show negative scope and snapshot identity; unchanged polling performs no source capture.'
      ],
      bypasses: [
        'Untested or failed data never renders as passed; absent data shows an error or unknown state.'
      ],
      allowedContributors: ['same-origin proof HTTP API', 'native browser DOM'],
      forbiddenContributors: [
        'static viewer mutation',
        'client-side conformance decisions'
      ],
      cacheDimensions: [],
      implementationBoundary: [
        'tools/flow-inspector/control-plane/public/index.html',
        'tools/flow-inspector/control-plane/public/board.js',
        'tools/flow-inspector/control-plane/public/board.css',
        'tools/flow-inspector/control-plane/__tests__/board.test.cjs'
      ],
      specRefs: ['#board'],
      failureOwnerStepId: 'render-proof-board'
    }
  ],
  routes: [
    {
      id: 'admit-proof-contract-to-capture-proof-source',
      from: 'admit-proof-contract',
      to: 'capture-proof-source',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:admitted-proof-contract']
    },
    {
      id: 'admit-proof-contract-to-assess-proof-evidence',
      from: 'admit-proof-contract',
      to: 'assess-proof-evidence',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:admitted-proof-contract']
    },
    {
      id: 'admit-proof-contract-to-serve-proof-actions',
      from: 'admit-proof-contract',
      to: 'serve-proof-actions',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:admitted-proof-contract']
    },
    {
      id: 'capture-proof-source-to-execute-proof-run',
      from: 'capture-proof-source',
      to: 'execute-proof-run',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:proof-source-snapshot']
    },
    {
      id: 'capture-proof-source-to-assess-proof-evidence',
      from: 'capture-proof-source',
      to: 'assess-proof-evidence',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:proof-source-snapshot']
    },
    {
      id: 'execute-proof-run-to-assess-proof-evidence',
      from: 'execute-proof-run',
      to: 'assess-proof-evidence',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:proof-runner-result']
    },
    {
      id: 'assess-proof-evidence-to-serve-proof-actions',
      from: 'assess-proof-evidence',
      to: 'serve-proof-actions',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:assessed-proof-evidence']
    },
    {
      id: 'serve-proof-actions-to-render-proof-board',
      from: 'serve-proof-actions',
      to: 'render-proof-board',
      kind: 'handoff',
      predicate: 'The producer completed its declared boundary.',
      producedArtifacts: ['artifact:proof-board-state']
    },
    {
      id: 'render-proof-board-terminal',
      from: 'render-proof-board',
      kind: 'terminal',
      predicate: 'The board has rendered the selected attempt.',
      producedArtifacts: ['artifact:proof-board-view']
    }
  ],
  artifacts: [
    {
      id: 'artifact:admitted-proof-contract',
      title: 'Admit proof contract output',
      ownerStepId: 'admit-proof-contract',
      channel: 'local-proof',
      consumerStepIds: [
        'capture-proof-source',
        'assess-proof-evidence',
        'serve-proof-actions'
      ]
    },
    {
      id: 'artifact:proof-source-snapshot',
      title: 'Capture proof source output',
      ownerStepId: 'capture-proof-source',
      channel: 'local-proof',
      consumerStepIds: ['execute-proof-run', 'assess-proof-evidence']
    },
    {
      id: 'artifact:proof-runner-result',
      title: 'Execute proof run output',
      ownerStepId: 'execute-proof-run',
      channel: 'local-proof',
      consumerStepIds: ['assess-proof-evidence']
    },
    {
      id: 'artifact:assessed-proof-evidence',
      title: 'Assess proof evidence output',
      ownerStepId: 'assess-proof-evidence',
      channel: 'local-proof',
      consumerStepIds: ['serve-proof-actions']
    },
    {
      id: 'artifact:proof-board-state',
      title: 'Serve proof actions output',
      ownerStepId: 'serve-proof-actions',
      channel: 'local-proof',
      consumerStepIds: ['render-proof-board']
    },
    {
      id: 'artifact:proof-board-view',
      title: 'Render proof board output',
      ownerStepId: 'render-proof-board',
      channel: 'local-proof',
      consumerStepIds: [],
      terminal: true
    }
  ],
  invariants: [
    {
      id: 'snapshot-bound-pass',
      statement:
        'A pass describes complete observed obligations for one captured source, never a deployment or an untested flow.',
      stepIds: [
        'admit-proof-contract',
        'capture-proof-source',
        'execute-proof-run',
        'assess-proof-evidence',
        'serve-proof-actions',
        'render-proof-board'
      ],
      artifactIds: ['artifact:assessed-proof-evidence'],
      specRefs: ['#source-and-evidence']
    }
  ],
  acceptanceContracts: [
    {
      id: 'bounded-core-proof',
      title: 'Core proof cases and completion',
      stepIds: [
        'admit-proof-contract',
        'capture-proof-source',
        'execute-proof-run',
        'assess-proof-evidence',
        'serve-proof-actions',
        'render-proof-board'
      ],
      assertions: [
        'Baseline passes both flows, the isolated inverse violation fails only its observed obligations, and a new baseline recovers.',
        'Incomplete evidence and unauthorized actions cannot pass or execute.'
      ],
      specRefs: ['#cases-and-completion']
    }
  ]
}

globalThis.FLOW_INSPECTOR_DATA = data
if (typeof module !== 'undefined') module.exports = data
