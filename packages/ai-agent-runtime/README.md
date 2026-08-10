# `@asyra/ai-agent-runtime`

Optional orchestration for turning natural-language intent into registered, app-approved actions.

## Install

```bash
npm install @asyra/ai-agent-runtime
```

```ts
import { createAiAgentRuntime } from '@asyra/ai-agent-runtime'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- provider requests and bounded action-batch validation
- permission, optional confirmation, ordered execution, progress, audit, and cleanup
- one app-supplied transaction-runner call around accepted executors

## Does not own

- model vendors, credentials, app-domain actions, canonical state, Feature sessions, or transaction implementation

## Start here

Compose it only when an App has explicit action schemas, permissions, provider policy, and canonical action executors.

## Lifecycle and composition

Import and construction are inert. A run obtains bounded context, resolves registered actions, checks permission, optionally confirms, and executes through the App transaction runner. Invalid, denied, cancelled, aborted, or failed work applies no hidden canonical prefix.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/ai-agent-runtime.md)
- [Execute one prepared action through a registered boundary](https://github.com/karote00/asyra/blob/main/docs/examples/ai-agent-runtime.mjs) — `yarn examples:run ai-registered-action`
- [Let app retrieval find; let Feature API mutate](https://github.com/karote00/asyra/blob/main/docs/examples/app-retrieval-action.mjs) — `yarn examples:run app-retrieval-action`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
