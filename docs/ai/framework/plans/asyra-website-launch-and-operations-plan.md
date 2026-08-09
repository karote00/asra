# Asyra Website Launch and Operations Plan

## Status

Final child plan of the
[Asyra Framework Website Program](asyra-framework-website-plan.md). Preview
closure is authorized only as part of a future implementation task. Production
deployment, domain mutation, external service creation, and other external
writes require separate explicit user authorization at execution time.

Implementation requires an exact launch Inspector, environment and ownership
contract, executable deployment cases, rollback path, and bounded Definition
of Done.

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
documentation semantics, examples, Landing narrative, Atlas behavior, or
visual design. It cannot rewrite failed upstream work during launch closure.

## Authorization Boundary

- Local and isolated Preview validation does not authorize production writes.
- Hosting/provider selection, production project creation, DNS/domain changes,
  analytics, monitoring services, and secrets require explicit decisions and
  applicable approval.
- No publication, tag, package release, merge, push, or unrelated external
  operation is implied by website deployment authority.

## Preview Acceptance

The candidate Preview must use one exact release inventory and include all
accepted routes. It must pass:

- production build, test, lint, and type checks;
- content source, drift, generated inventory, links, anchors, and search;
- executable examples and all Runtime Atlas cases;
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
   search, examples, Atlas, and verified external links;
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

## Implementation Stages

1. Freeze hosting, environment, authorization, domain, rollback, and launch
   Inspector contracts.
2. Build the immutable candidate and complete isolated Preview acceptance.
3. Present Preview evidence and unresolved external decisions to the user.
4. Obtain explicit production-deployment authorization.
5. Deploy the exact accepted candidate.
6. Run production verification and either accept or roll back.
7. Record the verified public URL and approved operational ownership.

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
- The canonical public URL, routes, search, examples, Atlas, metadata, external
  links, accessibility, and performance are verified in production.
- Rollback and operational ownership are documented and usable.
- Package/CLI publication and unrelated external operations remain outside this
  plan's authority.
