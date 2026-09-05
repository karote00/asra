import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import path from 'node:path'
import process from 'node:process'
import { checksumText } from './distribution-files.mjs'

export function verifyDistribution(directory) {
  const expected = readFileSync(path.join(directory, 'SHA256SUMS'), 'utf8')
  if (!expected || expected !== checksumText(directory))
    throw new Error(
      'Distribution files are missing, added or changed. Obtain a fresh trusted copy.'
    )
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.argv.length > 2)
    throw new Error('This verifier accepts no arguments.')
  verifyDistribution(fileURLToPath(new URL('./', import.meta.url)))
  process.stdout.write(
    'All distribution file checksums match. This is integrity evidence, not publisher authentication.\n'
  )
}
