# `create-asyra-app` scaffold source

This directory is the CLI-owned source used by the official generator to build
`create-app/asyra/template`. It is not an App, workspace product, or canonical
product implementation.

From the repository root:

```bash
yarn release:app --prod=create-asyra-app
yarn release:app:check --prod=create-asyra-app
```

The generated project is intentionally one React homepage with the Asyra
Framework logo and no product-domain behavior. Product code begins only after a
user creates their own project with `create-asyra-app`.

## Support and contribution policy

This repository does not accept external issues or contributions, including
pull requests. Follow the repository security policy for sensitive reports.
