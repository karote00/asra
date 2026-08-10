# `create-asyra-design-app`

Create an immediately editable **Asyra Design** product from the official
standalone template. This is the recommended beginner entrance when you want to
learn from a working product and continue building it directly or with an AI
coding agent.

Requirements:

- Node.js 24.x
- Yarn, npm, or pnpm

## Create a project

```bash
npx create-asyra-design-app my-product
```

The CLI asks which supported package manager to use, copies the verified
template into one new directory, creates its package-manager files, and
installs dependencies.

For automation, select the package manager explicitly:

```bash
npx create-asyra-design-app my-product --package-manager=yarn
npx create-asyra-design-app my-product --package-manager=npm
npx create-asyra-design-app my-product --package-manager=pnpm
```

Both `--package-manager=value` and `--package-manager value` are supported.
Project names must be one new directory name; absolute paths, `.`/`..`, nested
paths, and existing targets are rejected.

## Start editing

```bash
cd my-product
yarn start
```

For npm or pnpm, use the exact start command printed by the CLI:

```bash
npm run start
pnpm start
```

Open:

```text
http://localhost:3000/?fileId=my-design
```

The non-empty `fileId` is the App document and collaboration-room identity.
The generated frontend remains locally editable when its reference socket
service is unavailable, but that disconnected path is not durable backend
persistence or multi-Actor collaboration.

## Run the complete local services

Start these in separate terminals:

```bash
yarn document:backend
```

```bash
yarn collaboration:server
```

```bash
yarn start
```

Use `npm run <script>` or `pnpm <script>` for the selected package manager. The
generated environment points the browser to the local reference socket service
and the socket server to the local document backend. Opening the same `fileId`
in two windows exercises the complete checkpoint, live publication, and
durability path.

Production authentication, authorization, backup, retention, custom domain
rules, and service topology remain App/backend responsibilities.

## Continue with Asyra

The generated project is normal source code. Start with one bounded App-owned
extension, keep its domain rules out of Framework packages, route mutations
through Features and public APIs, add tests, and then expand the product.

- [Generated-product walkthrough](https://github.com/karote00/asyra/blob/main/docs/public/start/create-design-app.md)
- [Extend with an AI coding agent](https://github.com/karote00/asyra/blob/main/docs/public/start/extend-with-ai.md)
- [Framework learning guides](https://github.com/karote00/asyra/blob/main/docs/public/index.md)
- [Advanced implementation guides](https://github.com/karote00/asyra/blob/main/docs/public/build/custom-schema.md)
- [Complete public documentation](https://github.com/karote00/asyra/blob/main/docs/public/index.md)
- [Asyra Design case study](https://github.com/karote00/asyra/blob/main/docs/public/cases/asyra-design.md)

`create-asyra-design-app` teaches how a real product uses Asyra. The Framework
documentation and Runtime Atlas remain a separate entrance for learning Core,
Preset, transactions, schemas, custom rendering, collaboration, and registered
AI actions without first understanding the full product stack.

## Verify

Run the standalone gates after an extension:

```bash
yarn typecheck
yarn react:build
yarn test
```

With the complete services running:

```bash
yarn test:e2e
yarn test:e2e:collaboration
```

Use the equivalent npm or pnpm script command when that manager was selected.

## Generated project contract

- `apps/asyra-design` is the canonical reference-product source.
- `apps/asyra-design/TEMPLATE.md` is the canonical generated README source.
- the official generator materializes
  `create-app/asyra-design/template`; generated output receives no handwritten
  product fixes.
- Framework dependency versions are resolved from the reviewed release
  manifests, and generated code uses declared public entrypoints only.
- Framework owns deterministic mechanics, Preset owns optional official
  defaults, the generated App owns product/domain behavior, and App services
  own transport, authorization, durability, and model-provider policy.

The generated project supports the current browser/Core composition, official
Preset `2D`, and engine-neutral `CUSTOM` extension boundary. Public Headless
Core, Core Kernel, production `3D`/`HYBRID`, auto-layout, and unit-aware
aggregation are future work.

## Support and contribution policy

This repository does not accept external issues or contributions, including
pull requests. You may use and fork the CLI and generated product under the MIT
License. Follow the upstream
[security policy](https://github.com/karote00/asyra/blob/main/SECURITY.md) for
security-sensitive reports and the
[release support contract](https://github.com/karote00/asyra/blob/main/docs/ai/framework/RELEASE_SUPPORT.md)
for current runtime and package boundaries.

## License

[MIT](LICENSE)
