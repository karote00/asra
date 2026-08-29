const caseIds = Object.freeze([
  'distinct-project-preservation',
  'integrated-preview-acceptance',
  'immutable-production-candidate',
  'production-indexing-metadata',
  'anonymous-production-surface',
  'rollback-readiness'
])

const step = (definition) =>
  Object.freeze({ cacheDimensions: [], ...definition })

module.exports = Object.freeze({
  authority: Object.freeze({
    specPath:
      'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md',
    inspectorPath:
      'docs/ai/framework/plans/asyra-website-launch-and-operations-flow-inspector.data.cjs',
    programPath: 'docs/ai/framework/plans/asyra-framework-website-plan.md',
    siteWorkspacePath: 'apps/asyra-framework-site',
    contentIndexPath: 'docs/public/generated/content-index.json',
    advancedGuidesRoot: 'docs/public',
    rootHostingConfigPath: 'vercel.json',
    atlasPlanPath: 'docs/ai/framework/plans/asyra-runtime-atlas-plan.md'
  }),
  caseIds,
  steps: Object.freeze([
    step({
      id: 'freeze-launch-contract',
      order: 1,
      ownerPackage: 'Launch product and authorization contract',
      purpose:
        'Freeze target separation, accepted-candidate, indexing, anonymous verification, rollback, external-write, and stop contracts before provider mutation.',
      inputs: [
        'accepted website program contract',
        'eight accepted upstream child artifacts',
        'explicit user production authority',
        'read-only existing Asyra Design hosting identity'
      ],
      outputs: ['artifact:launch-contract'],
      conditions: [
        'The Framework site uses a dedicated Vercel project and never mutates the existing Asyra Design project id or stable alias.',
        'Every Preview and production deployment identifies one exact source commit and reviewed configuration.',
        'Repository-configured Git automation may deploy changed Framework-site artifact inputs after the applicable pull request or main-branch gates pass.',
        'Production indexing is project-scoped and enabled only for the accepted production environment.',
        'Custom DNS, analytics, monitoring vendors, new secrets, and package publication remain excluded.'
      ],
      bypasses: [
        'A provider-owned vercel.app production alias is sufficient; custom DNS is not required for first launch.'
      ],
      allowedContributors: [
        'Launch plan and Inspector',
        'accepted child plans and generated inventories',
        'explicit user authorization',
        'read-only provider and repository facts'
      ],
      forbiddenContributors: [
        'unverified public URL',
        'secret value in repository or logs',
        'Asyra Design project mutation',
        'upstream product semantic rewrite'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md',
        'docs/ai/framework/plans/asyra-website-launch-and-operations-flow-inspector.data.cjs',
        'docs/ai/framework/plans/__tests__/asyra-website-launch-and-operations-flow-inspector.contract.test.cjs'
      ],
      specRefs: [
        '#authorization-boundary',
        '#bounded-task-contract',
        '#executable-launch-cases',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'freeze-launch-contract'
    }),
    step({
      id: 'accept-integrated-preview',
      order: 2,
      ownerPackage: 'Integrated Release Candidate Preview',
      purpose:
        'Accept one exact integration commit only after every upstream, content, runtime, visual, clean-consumer, release, and site gate passes.',
      inputs: ['artifact:launch-contract', 'eight accepted upstream artifacts'],
      outputs: ['artifact:accepted-preview'],
      conditions: [
        'The accepted commit is clean, pushed, immutable, and recorded before deployment.',
        'Generated release, content, advanced-guide, support, and external-link facts match their current owners.',
        'Build, typecheck, lint, tests, routes, accessibility, performance, visual review, Atlas, clean-consumer, and release-readiness gates pass.'
      ],
      bypasses: [
        'Registry publication remains outside this website child; provisional facts must remain labeled by their accepted generated owner.'
      ],
      allowedContributors: [
        'accepted integration commit',
        'deterministic project-owned gates',
        'CI and synchronized visual evidence'
      ],
      forbiddenContributors: [
        'dirty working tree',
        'manual inspection as sole evidence',
        'missing-case allowlist',
        'deployment success used as Preview correctness'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/**',
        'apps/asyra-framework-site/vercel.json',
        'apps/asyra-framework-site/next.config.ts',
        'apps/asyra-framework-site/app/layout.tsx',
        'apps/asyra-framework-site/app/robots.ts',
        'apps/asyra-framework-site/app/sitemap.ts',
        'apps/asyra-framework-site/lib/site-origin.ts',
        'apps/asyra-framework-site/__tests__/launch.test.mjs',
        'apps/asyra-framework-site/__tests__/e2e/launch-production.spec.ts',
        'apps/asyra-framework-site/scripts/production-smoke.mjs',
        'docs/public/**',
        'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md'
      ],
      specRefs: [
        '#preview-acceptance',
        '#quality-gates',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'accept-integrated-preview'
    }),
    step({
      id: 'configure-vercel-target',
      order: 3,
      ownerPackage: 'Dedicated Framework site hosting target',
      purpose:
        'Resolve or create one dedicated Vercel project, freeze its exact ids and production alias, and apply the accepted candidate build and production-only indexing environment contract without changing tracked source.',
      inputs: ['artifact:launch-contract', 'artifact:accepted-preview'],
      outputs: ['artifact:configured-vercel-target'],
      conditions: [
        'The selected org and project ids differ from the read-only Asyra Design link.',
        'The project root and build settings resolve the Framework site workspace and repository workspace dependencies.',
        'Git deployment is enabled only for the dedicated Framework site project and the app-owned ignore command selects builds from tracked artifact inputs rather than release versions.',
        'NEXT_PUBLIC_SITE_INDEXING=true exists only as a project-scoped production setting.',
        'No token, secret, or provider credential is written to tracked files or printed.'
      ],
      bypasses: [
        'Local project metadata may remain ignored and ephemeral; the accepted tracked configuration and recorded non-secret ids are the review authority.'
      ],
      allowedContributors: [
        'authenticated Vercel project API or CLI facts',
        'accepted app-owned Next.js and Vercel configuration',
        'accepted public origin'
      ],
      forbiddenContributors: [
        'root .vercel link mutation',
        'existing Asyra Design project id or alias',
        'unapproved custom domain or analytics',
        'unreviewed provider default presented as contract',
        'tracked website source or configuration change after Preview acceptance'
      ],
      implementationBoundary: [
        'authenticated Vercel project and environment operations',
        'apps/asyra-framework-site/vercel.json',
        'apps/asyra-framework-site/scripts/vercel-ignore-build.mjs',
        '.github/workflows/main.yml',
        'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md',
        '.vercel/project.json read-only; never mutate'
      ],
      specRefs: [
        '#authorization-boundary',
        '#deployment-and-verification-contract',
        '#executable-launch-cases'
      ],
      failureOwnerStepId: 'configure-vercel-target'
    }),
    step({
      id: 'deploy-accepted-candidate',
      order: 4,
      ownerPackage: 'Immutable production deployment',
      purpose:
        'Deploy the exact accepted commit and configured target, retain immutable deployment identity and the prior healthy rollback target, and promote only the reviewed candidate.',
      inputs: [
        'artifact:accepted-preview',
        'artifact:configured-vercel-target'
      ],
      outputs: ['artifact:production-deployment', 'artifact:rollback-target'],
      conditions: [
        'Preview deployments use pull request commits and Production deployments use accepted main-branch commits from the same reviewed Git integration.',
        'A deployment is selected by Framework-site artifact inputs and never requires a release-version change.',
        'The deployment build succeeds under the project-owned Node and Yarn contract.',
        'The stable production alias resolves the new immutable deployment only after provider success.',
        'The immediately prior healthy deployment remains resolvable for rollback.'
      ],
      bypasses: [
        'A first project deployment records rollback as unpromote/delete-current rather than fabricating a previous healthy production.'
      ],
      allowedContributors: [
        'accepted commit',
        'configured Vercel target',
        'provider deployment and alias records'
      ],
      forbiddenContributors: [
        'dirty or different source commit',
        'provider dashboard edit outside reviewed configuration',
        'deployment token or environment value in output',
        'promotion before build success'
      ],
      implementationBoundary: [
        'authenticated Vercel project and deployment operations',
        'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md'
      ],
      specRefs: [
        '#deployment-and-verification-contract',
        '#executable-launch-cases',
        '#quality-gates'
      ],
      failureOwnerStepId: 'deploy-accepted-candidate'
    }),
    step({
      id: 'verify-production',
      order: 5,
      ownerPackage: 'Anonymous production verification',
      purpose:
        'Fail closed on anonymous route, TLS, redirect, headers, cache, indexing, metadata, sitemap, search, advanced guides, Atlas, external-link, accessibility, responsive, or performance drift.',
      inputs: ['artifact:production-deployment', 'artifact:rollback-target'],
      outputs: ['artifact:verified-production'],
      conditions: [
        'The stable alias and immutable deployment use TLS and return the same accepted site.',
        'Robots permits production indexing and sitemap and metadata URLs use the stable accepted origin.',
        'Every public route, search path, advanced guide, release fact, Roadmap, Asyra Design link, and Runtime Atlas case works anonymously.',
        'Security, cache, accessibility, responsive, reduced-motion, performance, and failure behavior gates pass.'
      ],
      bypasses: [
        'Provider authentication, dashboard state, or logged-in browser evidence never substitutes anonymous checks.'
      ],
      allowedContributors: [
        'anonymous HTTPS responses',
        'production browser execution',
        'bounded header, SEO, route, accessibility, and performance tests'
      ],
      forbiddenContributors: [
        'authenticated-only success',
        'Preview URL used as production proof',
        'manual screenshot as sole evidence',
        'failed candidate left promoted after a blocking result'
      ],
      implementationBoundary: [
        'apps/asyra-framework-site/__tests__/e2e/launch-production.spec.ts',
        'apps/asyra-framework-site/scripts/production-smoke.mjs',
        'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md',
        'anonymous production URL read-only verification',
        'authorized rollback operation on blocking failure'
      ],
      specRefs: [
        '#deployment-and-verification-contract',
        '#executable-launch-cases',
        '#quality-gates'
      ],
      failureOwnerStepId: 'verify-production'
    }),
    step({
      id: 'record-launch-operations',
      order: 6,
      ownerPackage: 'Launch operations record',
      purpose:
        'Record the verified canonical URL, immutable deployment and source identities, indexing state, rollback procedure, operational exclusions, and acceptance evidence without recording credentials.',
      inputs: [
        'artifact:verified-production',
        'artifact:production-deployment',
        'artifact:rollback-target'
      ],
      outputs: ['artifact:accepted-public-website'],
      conditions: [
        'The public URL and source commit are exact and anonymously re-verifiable.',
        'Rollback uses recorded provider deployment identity or first-deployment unpromotion procedure.',
        'No analytics or monitoring ownership is implied when those services remain excluded.'
      ],
      bypasses: [
        'Provider-native deployment status and logs are sufficient operational evidence; no new monitoring vendor is required.'
      ],
      allowedContributors: [
        'verified production artifact',
        'provider deployment and rollback ids',
        'Launch plan status and evidence'
      ],
      forbiddenContributors: [
        'credential or secret value',
        'unverified vanity URL',
        'unapproved monitoring or incident commitment'
      ],
      implementationBoundary: [
        'docs/ai/framework/plans/completed/asyra-website-launch-and-operations-plan.md'
      ],
      specRefs: [
        '#operational-contract',
        '#quality-gates',
        '#definition-of-done'
      ],
      failureOwnerStepId: 'record-launch-operations'
    })
  ]),
  artifacts: Object.freeze(
    [
      ['artifact:launch-contract', 'freeze-launch-contract'],
      ['artifact:accepted-preview', 'accept-integrated-preview'],
      ['artifact:configured-vercel-target', 'configure-vercel-target'],
      ['artifact:production-deployment', 'deploy-accepted-candidate'],
      ['artifact:rollback-target', 'deploy-accepted-candidate'],
      ['artifact:verified-production', 'verify-production'],
      ['artifact:accepted-public-website', 'record-launch-operations']
    ].map(([id, ownerStepId]) => Object.freeze({ id, ownerStepId }))
  ),
  routes: Object.freeze(
    [
      [
        'freeze-launch-contract',
        'accept-integrated-preview',
        'artifact:launch-contract'
      ],
      [
        'accept-integrated-preview',
        'configure-vercel-target',
        'artifact:accepted-preview'
      ],
      [
        'configure-vercel-target',
        'deploy-accepted-candidate',
        'artifact:configured-vercel-target'
      ],
      [
        'accept-integrated-preview',
        'deploy-accepted-candidate',
        'artifact:accepted-preview'
      ],
      [
        'deploy-accepted-candidate',
        'verify-production',
        'artifact:production-deployment'
      ],
      [
        'deploy-accepted-candidate',
        'verify-production',
        'artifact:rollback-target'
      ],
      [
        'verify-production',
        'record-launch-operations',
        'artifact:verified-production'
      ],
      [
        'deploy-accepted-candidate',
        'record-launch-operations',
        'artifact:production-deployment'
      ],
      [
        'deploy-accepted-candidate',
        'record-launch-operations',
        'artifact:rollback-target'
      ]
    ].map(([from, to, artifactId], index) =>
      Object.freeze({
        id: `launch-route-${String(index + 1).padStart(2, '0')}`,
        from,
        to,
        producedArtifacts: Object.freeze([artifactId])
      })
    )
  ),
  invariants: Object.freeze([
    'The Framework site project and Asyra Design project remain distinct.',
    'Every Preview and production deployment resolves one exact source commit and reviewed Git configuration.',
    'Continuous deployment selection follows tracked Framework-site artifact inputs rather than release-version cadence.',
    'Only production permits indexing and every absolute public URL uses the accepted stable origin.',
    'No credential, secret, private endpoint, or internal-only document is published.',
    'Anonymous production evidence is required before the stable alias is accepted.',
    'A blocking verification result restores or unpromotes the failed candidate.',
    'Custom DNS, analytics, monitoring vendors, new secrets, and package publication remain excluded.'
  ])
})
