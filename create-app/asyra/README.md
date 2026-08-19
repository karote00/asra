# `create-asyra-app`

Create a minimal React shell for an Asyra Framework product. Use this entry
when you want a blank product surface instead of the complete Asyra Design
reference application.

Requirements:

- Node.js 24.x
- Yarn, npm, or pnpm

## Create and start

```bash
npx create-asyra-app my-product
cd my-product
yarn start
```

Select a package manager non-interactively when needed:

```bash
npx create-asyra-app my-product --package-manager=yarn
npx create-asyra-app my-product --package-manager=npm
npx create-asyra-app my-product --package-manager=pnpm
```

The CLI accepts one new directory name, copies the verified template, writes
the selected package-manager identity/configuration, and installs dependencies
to create its lockfile. Existing targets,
absolute paths, nested paths, and `.`/`..` are rejected.

Open `http://localhost:3000`. The initial page contains only the original
Asyra Framework logo, a short starting point, and the Framework guide link.

## Continue with Asyra

The generated project includes `AGENTS.md` and `docs/framework.md`. Humans and
AI coding agents should read them before adding domain behavior or Framework
packages.

- [Framework getting started](https://github.com/karote00/asyra/blob/main/docs/ai/framework/GETTING_STARTED.md)
- [Public documentation](https://github.com/karote00/asyra/blob/main/docs/public/index.md)
- [Executable examples](https://github.com/karote00/asyra/tree/main/docs/examples)
- [Complete Asyra Design starter](../asyra-design/README.md)

## Verify

```bash
yarn typecheck
yarn react:build
yarn test
```

## Release verification

Before publishing a manually selected CLI version, create the real npm
tarball and prove it through clean Yarn, npm, and pnpm consumers:

```bash
yarn release:create-asyra-app
```

The gate checks the packed identity and file allowlist, installs the tarball,
generates a fresh project with each package manager, and runs that project's
test, typecheck, and production build. It reports the project-local tarball
path and SHA-256 checksum for release review.

After publication, verify the exact manifest version from the public registry:

```bash
yarn release:create-asyra-app:registry
```

The CLI version is selected manually and is independent from the private
starter/template version. Publishing still requires explicit authorization.

## Generated project contract

- `apps/asyra-starter` is the canonical source.
- `apps/asyra-starter/TEMPLATE.md` is the generated README source.
- `create-app/asyra/template` is generated only through the official release
  generator; it receives no handwritten fixes.
- The starter is deliberately domain-empty. Add only the public Asyra packages
  and App-owned behavior required by your product.

## Support and contribution policy

This repository does not accept external issues or contributions, including
pull requests. You may use and fork the CLI and generated project under the MIT
License. Follow the upstream security policy for sensitive reports.

## License

[MIT](LICENSE)
