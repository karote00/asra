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
Asyra Framework logo, a short starting point, and the GitHub project link.

## Continue with Asyra

The generated project includes an `AGENTS.md` that directs humans and coding
agents to the official Asyra GitHub project without copying internal Framework
documentation into your App.

- [Asyra GitHub project](https://github.com/karote00/asyra)
- [Complete Asyra Design starter](../asyra-design/README.md)

## Verify

```bash
yarn typecheck
yarn react:build
```

The starter does not install or configure a testing framework. Each product can
choose its own testing tools.

## Generated project contract

- `apps/asyra` is the corresponding empty App and generator source.
- `apps/asyra/README.md` is the generated README source.
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
