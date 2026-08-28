# Asyra Website Launch and Operations Plan

## Status

Final child plan of the
[Asyra Framework Website Program](completed/asyra-framework-website-plan.md).
Implementation and production acceptance completed on August 10, 2026. The
user granted explicit authority in this integrated release task to create one
separate Vercel project for the Framework site, configure its non-secret
indexing flag, deploy the accepted candidate to production, verify it
anonymously, and roll it back if a release-blocking production check fails.
This authority does not extend to custom DNS, analytics, monitoring vendors,
new secrets, package publication, or mutation of the existing Asyra Design
project.

The exact launch Inspector, environment and ownership contract, executable
deployment cases, rollback path, and bounded Definition of Done are frozen in
[the Launch flow Inspector](asyra-website-launch-and-operations-flow-inspector.data.cjs).

On August 28, 2026, the user additionally authorized repository-configured
continuous Git deployments for the dedicated Framework site project. Pull
request commits may create Preview deployments and accepted `main` commits may
create Production deployments when the tracked Framework-site artifact inputs
change. This standing automation authority is scoped to the existing dedicated
Framework site project and does not extend to the Asyra Design project, custom
DNS, analytics, monitoring, new secrets, or package publication.

## Accepted Production Record

- Public URL: `https://asyra-framework.vercel.app`
- Immutable deployment URL:
  `https://asyra-framework-k2r6q54s3-karote00s-projects.vercel.app`
- Accepted website source:
  `172fc1b5fa2fa57c40ab4daf72e4624e5d7f8a29`
- Vercel deployment: `dpl_94LGWe6K5fu1hkztDgiPnpHp2ak8`
- Dedicated project: `asyra-framework`
  (`prj_IGSQKq4oQQPeXXQ948hiORc5BBAg`) in `karote00s-projects`
  (`team_HpJaUNDTB6ZDFDRJMCnEkp4W`)
- Existing Asyra Design project: unchanged
  (`prj_rMVZ3Pq4G3cb0dPDZmDpYfZNAElJ`, `https://asra.vercel.app`)

The accepted source passed Pull Request #125 `validate`, Framework release
readiness, ordinary E2E, Collaboration E2E, Asyra Design Preview, and Framework
site Preview checks before production deployment. The dedicated target uses
Node `24.x`, Yarn `4.3.1` through Corepack, the generated Framework-site Turbo
owner task, and the app-owned `dist` output. The tracked build contract and
provider project settings were read back as equal before deployment.

Production verification passed all 49 anonymous public route and metadata
smoke checks, all three Launch production browser cases, and all 20 maintained
site browser cases. The maintained cases cover search, Landing, documentation,
Asyra Design evidence, releases, Roadmap, all six Runtime Atlas cases,
accessibility, responsive layouts, reduced motion, no-client-JavaScript
reading, and the bounded runtime and resource budgets. Synchronized agent
review additionally inspected the live desktop Landing and an accepted Runtime
Atlas execution; formal `390x844`, `320px`, and `200%` reflow cases own mobile
evidence.

Both accepted production URLs return the same anonymously accessible HTML over
verified TLS. The stable alias exposes the reviewed CSP, permissions, referrer,
HSTS, MIME-sniffing, framing, cache, robots, sitemap, and canonical metadata
contracts. `NEXT_PUBLIC_SITE_INDEXING=true` exists only for the Production
environment. Vercel Authentication is scoped to `preview`, so Preview URLs
remain protected while the stable and immutable production URLs remain public.

This is the first healthy production deployment. Its first-deployment rollback
is exact unpromotion or deletion of
`dpl_94LGWe6K5fu1hkztDgiPnpHp2ak8`, followed by anonymous verification that the
stable alias no longer serves the rejected candidate. The exact deletion path
was proven before acceptance against the failed candidate
`dpl_HhMZzbYkmAKYCGpc1e7U58EgPcuW`, whose deployment lookup returned `404`
after deletion. For the next release, the deployment recorded here becomes the
previous healthy rollback target and must remain resolvable until the new
candidate passes production verification.

No custom DNS, analytics, monitoring vendor, new secret, package publication,
or Asyra Design hosting mutation was introduced. The operations-record and
canonical-oracle test commits follow the deployed source without changing the
accepted website runtime and must pass the final child PR checks before merge.

## Goal

Prove that one completed website Preview is safe, current, observable, and
ready for public use, then deploy and verify it only after explicit authority.
This plan must not use launch pressure to waive incomplete product, content,
runtime, visual, or accessibility work.

## Ownership Boundary

This plan owns:

- Preview integration and final cross-workstream verification;
- approved hosting configuration and environment separation;
- domain, redirects, headers, cache, sitemap, robots, and public metadata;
- deployment runbook, rollback, and post-deployment checks; and
- approved operational monitoring and incident ownership.

It does not own package/CLI publication, README updates, package behavior,
documentation semantics, advanced guides, Landing narrative, Atlas behavior, or
visual design. It cannot rewrite failed upstream work during launch closure.

## Authorization Boundary

- Local and isolated Preview validation does not authorize production writes.
- Hosting/provider selection, production project creation, DNS/domain changes,
  analytics, monitoring services, and secrets require explicit decisions and
  applicable approval.
- No publication, tag, package release, merge, push, or unrelated external
  operation is implied by website deployment authority.

For this task, production project creation, the project-scoped
`NEXT_PUBLIC_SITE_INDEXING=true` setting, Preview and production deployment,
stable provider alias assignment, anonymous verification, rollback, child PR
push, CI, and merge are explicitly authorized. The root `.vercel` link and
`https://asra.vercel.app` remain owned by Asyra Design and are immutable inputs.

## Bounded Task Contract

This child owns launch-only configuration, integrated Preview acceptance, a
dedicated Vercel target, production deployment, canonical-origin metadata,
robots and sitemap publication, security and cache headers, anonymous
production verification, rollback proof, and the final public URL record.
Observable completion requires one exact source commit to pass local and CI
Preview gates, deploy through a project that is not the Asyra Design project,
and pass every anonymous production case before it is recorded as accepted.

Discovery is fixed to the accepted integration commit, the nine child plans,
generated content and advanced-guide contracts, the Framework site workspace, root
hosting configuration and read-only existing project metadata, Vercel's
authenticated project/deployment facts, and the launch gates named below.
Upstream product semantics, package publication, custom DNS, analytics,
monitoring services, new secrets, and Asyra Design deployment configuration are
excluded. A source change after Preview acceptance, target collision, missing
rollback candidate, secret exposure, or failed anonymous production gate is a
stop condition.

## Executable Launch Cases

1. `distinct-project-preservation`: the Framework site resolves to a dedicated
   project and the existing Asyra Design project id and stable alias remain
   unchanged.
2. `integrated-preview-acceptance`: one exact integration commit passes content,
   advanced guides, Atlas, build, type, lint, test, route, accessibility, responsive,
   visual, clean-consumer, and release-readiness gates.
3. `immutable-production-candidate`: production deploys the same accepted Git
   commit and reviewed configuration, without an unreviewed rebuild source.
4. `production-indexing-metadata`: production alone permits indexing and emits
   canonical absolute sitemap, robots, social, and metadata URLs from the
   accepted public origin.
5. `anonymous-production-surface`: an unsigned visitor can load all public
   routes, search, advanced guides, Asyra Design evidence, releases, Roadmap, and every
   Runtime Atlas case with required headers and budgets.
6. `rollback-readiness`: the immediately previous healthy deployment remains a
   resolvable rollback target; any blocking production result restores it or
   leaves the failed candidate unpromoted.

## Preview Acceptance

The pre-publication candidate Preview must use one exact provisional release
inventory and include all accepted routes. After applicable public release
writes, the final Preview must use externally verified generated facts and
repeat the affected gates. The accepted final Preview must pass:

- production build, test, lint, and type checks;
- content source, drift, generated inventory, links, anchors, and search;
- advanced implementation guides and all Runtime Atlas cases;
- beginner generated-app and registry-only clean-consumer validation;
- accessibility, responsive, reduced-motion, synchronized visual, and browser
  support cases;
- performance, SEO, metadata, sitemap, robots, security-header, and failure
  behavior budgets; and
- secret, private-endpoint, internal-document, and unapproved-asset exclusion.

## Deployment and Verification Contract

After explicit production authority:

1. resolve the exact approved deployment target and immutable candidate;
2. apply only reviewed production configuration and secrets;
3. deploy without rebuilding from an unreviewed source state;
4. verify canonical domain, TLS, redirects, headers, cache, metadata, routes,
   search, advanced guides, Atlas, and verified external links;
5. run bounded smoke, accessibility, and performance checks against production;
6. confirm monitoring and incident ownership if approved; and
7. roll back through the defined recoverable path if a release-blocking check
   fails.

## Operational Contract

Version and support data remain generated from release owners. Content drift
and broken-link checks must run on a defined cadence or release workflow.
Analytics is optional and cannot be added without approval, a data-minimization
contract, and public disclosure where required.

The website must expose verified security, support, license, release, and
contribution-policy links. It must not offer public issue or contribution flows
that contradict the separately owned repository policy.

### Continuous Git deployment selection

The dedicated Framework site uses Vercel Git integration for Preview and
Production deployments. Deployment selection follows the website artifact
graph, not a release-version comparison:

- `apps/asyra-framework-site/**` owns the site application, configuration, and
  public assets;
- `docs/public/**` owns the rendered documentation and generated public facts;
- `packages/**` owns the Framework runtime bundled by Runtime Atlas;
- `.yarn/releases/**`, `.yarnrc.yml`, `package.json`, `turbo.json`, and
  `yarn.lock` own the shared build and dependency environment.

The app-owned `scripts/vercel-ignore-build.mjs` compares the current commit to
its first parent. It continues the build when any owned input changed and
ignores the build otherwise. If the comparison cannot be resolved, it fails
open by continuing the build. A package or root version change is neither
required nor sufficient by itself: deployment occurs because a tracked
artifact input changed.

Pull request deployments remain Preview deployments. Production deployment is
limited to accepted commits on `main`; repository branch protection and CI own
pre-merge correctness, while Vercel owns the immutable build and alias update.
Deployment success never substitutes for the required CI, site, content, or
production verification gates. The previous healthy Production deployment
remains the rollback target.

## Implementation Stages

1. Freeze hosting, environment, authorization, domain, rollback, and launch
   Inspector contracts.
2. Complete every tracked hosting, stable-origin, metadata, indexing, header,
   smoke, and production-browser input before freezing the candidate.
3. Build the candidate, reconcile generated public facts, open the child PR,
   and accept one exact pushed commit only after local and CI Preview gates
   pass.
4. Resolve or create the authorized dedicated Vercel project and configure its
   production-only non-secret environment without changing tracked source.
5. Deploy the exact accepted candidate and retain its immutable deployment
   identity and real rollback path.
6. Run anonymous production verification and either accept or immediately
   restore/unpromote the candidate.
7. Record the verified public URL, exact source, deployment identity, rollback
   procedure, evidence, and excluded operational ownership.

## Quality Gates

- the deployed artifact matches the accepted Preview candidate;
- all required Preview and production checks pass;
- no secret, internal-only document, private endpoint, or unsupported package
  fact is public;
- domain, TLS, redirect, caching, header, metadata, sitemap, robots, and error
  behavior are verified;
- external URLs and registry-only onboarding resolve from production;
- rollback is tested or otherwise proven through the approved provider path;
  and
- all external writes have explicit authority and recorded exact targets.

## Stop Conditions

- Any upstream workstream or Preview gate is incomplete.
- The candidate source or release inventory changes after acceptance.
- Production authority, exact target, domain owner, secrets owner, or rollback
  path is unresolved.
- Deployment requires an unapproved provider, dependency, analytics service,
  or external asset.
- Production verification detects a release-blocking failure.

## Definition of Done

- One immutable Preview passes every program and launch gate.
- Production deployment occurred only after explicit authorization.
- The canonical public URL, routes, search, advanced guides, Atlas, metadata, external
  links, accessibility, and performance are verified in production.
- Rollback and operational ownership are documented and usable.
- Package/CLI publication and unrelated external operations remain outside this
  plan's authority.
