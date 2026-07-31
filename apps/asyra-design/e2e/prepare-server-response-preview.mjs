import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareServerResponsePreview } from './prepared-server-response-artifacts.mjs'

const modulePath = fileURLToPath(import.meta.url)
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : ''

if (invokedPath === modulePath) {
  try {
    const summary = await prepareServerResponsePreview()
    process.stdout.write(
      `${JSON.stringify({
        currentPath: summary.currentPath,
        manifestPath: summary.manifestPath,
        productionIndexSha256: summary.productionIndexSha256,
        variants: summary.manifest.variants.map(
          ({ gzipBytes, itemCount, totalCount }) => ({
            gzipBytes,
            itemCount,
            totalCount
          })
        )
      })}\n`
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(
      `Prepared server response preview failed: ${message.slice(0, 500)}\n`
    )
    process.exitCode = 1
  }
}
