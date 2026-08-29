/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

const projectRoot = path.resolve(__dirname, '../..')
const rendererSource = fs
  .readFileSync(path.join(__dirname, 'viewer.js'), 'utf8')
  .trimEnd()
const viewerStylesSource = fs
  .readFileSync(path.join(__dirname, 'viewer.css'), 'utf8')
  .trimEnd()

const bundleSandbox = { globalThis: {} }
vm.runInNewContext(
  fs.readFileSync(
    path.join(__dirname, 'workspace/workspace-bundle.data.js'),
    'utf8'
  ),
  bundleSandbox
)
const targetEntries =
  bundleSandbox.globalThis.FLOW_INSPECTOR_WORKSPACE_BUNDLE.entries
    .filter((entry) => entry.standalonePath)
    .map((entry) => path.join(projectRoot, entry.standalonePath))
    .filter((entryPath) =>
      fs
        .readFileSync(entryPath, 'utf8')
        .includes('<script data-flow-inspector-renderer>')
    )

const embeddedScript = `    <script data-flow-inspector-renderer>\n${rendererSource}\n    </script>`
const embeddedStyles = `    <style data-flow-inspector-viewer-styles>\n${viewerStylesSource}\n    </style>`
const externalRendererPattern =
  /[ ]{4}<script src=["'][^"']*tools\/flow-inspector\/viewer\.js["']><\/script>/
const embeddedRendererPattern =
  /[ ]{4}<script data-flow-inspector-renderer>\n[\s\S]*?\n[ ]{4}<\/script>/
const embeddedStylesPattern =
  /[ ]{4}<style data-flow-inspector-viewer-styles>\n[\s\S]*?\n[ ]{4}<\/style>/

for (const entryPath of targetEntries) {
  const html = fs.readFileSync(entryPath, 'utf8')
  const rendererHtml = externalRendererPattern.test(html)
    ? html.replace(externalRendererPattern, embeddedScript)
    : html.replace(embeddedRendererPattern, embeddedScript)
  const nextHtml = embeddedStylesPattern.test(rendererHtml)
    ? rendererHtml.replace(embeddedStylesPattern, embeddedStyles)
    : rendererHtml.replace('</head>', `${embeddedStyles}\n  </head>`)

  if (!nextHtml.includes(embeddedScript)) {
    throw new Error(`No Flow Inspector renderer slot found in ${entryPath}`)
  }

  fs.writeFileSync(entryPath, nextHtml)
}
