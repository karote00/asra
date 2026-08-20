# `create-asyra-app`

Create a minimal React shell for an Asyra Framework product. Use this entry
when you want a blank product surface instead of the complete Asyra Design
reference application.

Requirement: Node.js 24.x and Yarn.

## Create and start

```bash
npx create-asyra-app my-product
cd my-product
yarn start
```

The CLI accepts one new directory name, copies the verified template, writes
the Yarn identity/configuration, and installs dependencies to create its
lockfile. Existing targets, absolute paths, nested paths, and `.`/`..` are
rejected.

Open `http://localhost:3000`. The initial page contains only the original
Asyra Framework logo, a short starting point, and the Framework guide link.

## Continue with Asyra

The generated project includes `AGENTS.md` and `docs/framework.md`. Humans and
AI coding agents should read them before adding domain behavior or Framework
packages.

- [Framework getting started](https://github.com/karote00/asyra/blob/main/docs/ai/framework/GETTING_STARTED.md)
- [Public documentation](https://github.com/karote00/asyra/blob/main/docs/public/index.md)
- [Complete Asyra Design starter](../asyra-design/README.md)

## Verify

```bash
yarn typecheck
yarn react:build
yarn test
```

## Generated project contract

- `apps/asyra` is the corresponding empty App and generator source.
- `apps/asyra/TEMPLATE.md` is the generated README source.
- `create-app/asyra/template` is generated only through the official release
  generator with `yarn release:app --prod=create-asyra-app`; it receives no
  handwritten fixes.
- The starter is deliberately domain-empty. Add only the public Asyra packages
  and App-owned behavior required by your product.

## Support and contribution policy

This repository does not accept external issues or contributions, including
pull requests. You may use and fork the CLI and generated project under the MIT
License. Follow the upstream security policy for sensitive reports.

## License

[MIT](LICENSE)
