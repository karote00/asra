<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Visual review artifact paths

- Treat this directory as the app root for every site visual test and review.
- Playwright screenshots must use `testInfo.outputPath(...)`; do not construct a
  second artifact root in individual specs.
- Keep Playwright `outputDir` anchored to this configuration file's app root,
  never through the caller's current working directory.
- Never append `apps/asyra-framework-site` to an output path when the command is
  already running from this app. The recursive path
  `apps/asyra-framework-site/apps/asyra-framework-site` is invalid.
