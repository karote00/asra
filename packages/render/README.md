# `@asyra/render`

Engine-neutral projection, layers, strategies, interaction bridges, viewport orchestration, and demand-driven frames.

## Requirements

- Node.js 24.x
- Yarn 4.3.1 for this repository's maintained workflows

## Install

```bash
npm install @asyra/render
```

```ts
import { RenderAdapter, RenderGraphics } from '@asyra/render'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- canonical-to-render projection, render registration, provider lifecycle through the abstract contract, interaction mapping, resources, and frame orchestration

## Does not own

- canonical documents, App Feature decisions, concrete SDK objects, Preset provider policy, or patch output for upstream bugs

## Start here

Compose it when canonical information needs visual projection or engine-backed interaction. Register strategies, layers, and targets before startup.

## Lifecycle and composition

Initialization validates and activates the selected provider. Dirty work requests one frame and explicit flush produces output. Provider, strategy, layer, interaction, resource, or cleanup failures remain explicit and never fall through to another engine.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/render.md)
- [Model information before choosing an output](https://github.com/karote00/asyra/blob/main/docs/examples/core-information-model.mjs) — `yarn examples:run core-information-model`
- [Prove an app-owned render-engine adapter](https://github.com/karote00/asyra/blob/main/docs/examples/custom-render-boundary.mjs) — `yarn examples:run custom-render-boundary`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
