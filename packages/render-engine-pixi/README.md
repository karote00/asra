# `@asyra/render-engine-pixi`

Official optional Pixi implementation of the public Render Engine contract for the current `2D` profile.

## Install

```bash
npm install @asyra/render-engine-pixi
```

```ts
import { createPixiRenderEngine } from '@asyra/render-engine-pixi'
```

Use only the package root and the explicitly documented public subpaths.

## Owns

- Pixi application, surface, objects, resources, ticker, event normalization, abstract command translation, flush, and cleanup

## Does not own

- Render subscriptions, Framework target mapping, canonical state, App Feature policy, custom-engine inspection, or fallback routing

## Start here

Use it through Preset `2D` or explicitly provide it in a browser composition. Apps with another engine do not import this package.

## Lifecycle and composition

Initialization creates one owned Pixi runtime behind opaque handles. Frame callbacks schedule and explicit flush renders. Destruction releases all owned objects and resources; partial initialization failure cleans up and never reports ready.

## Learn more

- [Complete package guide](https://github.com/karote00/asyra/blob/main/docs/public/reference/packages/render-engine-pixi.md)
- [Apply the complete official 2D baseline](https://github.com/karote00/asyra/blob/main/docs/examples/preset-2d-minimal.mjs) — `yarn examples:run preset-2d-minimal`
- [Framework release support](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)

## Support and policy

This repository does not accept external issues or contributions. You may use,
inspect, and fork the package under the [MIT License](https://github.com/karote00/asyra/blob/main/LICENSE).
Follow the [security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the [root policy](https://github.com/karote00/asyra) for the
current support boundary.
