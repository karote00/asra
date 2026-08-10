# `@asyra/render-engine`

Engine-independent contract shared by Render, official engines, and custom provider implementations.

## Install

```bash
npm install @asyra/render-engine
```

```ts
import type { RenderEngineProvider } from '@asyra/render-engine'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- engine/surface lifecycle, semantic commands and queries, opaque handles, normalized interactions, capabilities, errors, and conformance tools

## Does not own

- a concrete SDK, canonical subscriptions, render layers, Feature policy, a default singleton, or unimplemented production modes

## Start here

Implement the contract when your App or package supplies a rendering engine; keep Render consumers dependent on this abstraction.

## Lifecycle and composition

`initialize(...)` may be asynchronous; command, query, destroy, and explicit frame flush behavior remains deterministic. Missing capabilities reject through structured errors instead of SDK-specific fallback.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/render-engine.md)
- [Prove an app-owned render-engine adapter](https://github.com/karote00/asyra/blob/main/docs/examples/custom-render-boundary.mjs) — `yarn examples:run custom-render-boundary`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
