import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { assertOwnedPaths } from './consumer-contract.mjs'
import { sha256 } from './distribution-files.mjs'

/** Derive notices from actual main/Worker build inputs, not a guessed dependency list. */
export function bundledNotices(consumer, supplements) {
  const packages = new Map()
  const evidence = path.join(consumer, '.build-evidence')
  for (const filename of readdirSync(evidence).sort()) {
    const inputs = JSON.parse(
      readFileSync(path.join(evidence, filename), 'utf8')
    )
    for (const input of inputs) {
      const absolute = path.resolve(consumer, input)
      assertOwnedPaths(consumer, [absolute])
      if (!input.split('/').includes('node_modules')) continue
      let directory = path.dirname(absolute)
      while (directory !== consumer) {
        const filename = path.join(directory, 'package.json')
        if (existsSync(filename)) {
          assertOwnedPaths(consumer, [filename])
          const manifest = JSON.parse(readFileSync(filename, 'utf8'))
          if (manifest.name && manifest.version) {
            packages.set(directory, manifest)
            break
          }
        }
        const parent = path.dirname(directory)
        if (parent === directory)
          throw new Error(`Missing package identity for ${input}`)
        directory = parent
      }
      if (directory === consumer)
        throw new Error(`Missing package identity for ${input}`)
    }
  }
  if (!packages.size) throw new Error('No bundled dependency evidence.')
  const supplementsManifest = JSON.parse(
    readFileSync(path.join(supplements, 'sources.json'), 'utf8')
  )
  const records = []
  for (const [directory, manifest] of packages) {
    const identity = `${manifest.name}@${manifest.version}`
    if (typeof manifest.license !== 'string' || !manifest.license)
      throw new Error(`Missing license declaration: ${identity}`)
    const notices = readdirSync(directory)
      .filter((name) => /^(license|licence|notice|copying)([.-]|$)/i.test(name))
      .sort()
      .map((name) => {
        const filename = path.join(directory, name)
        assertOwnedPaths(consumer, [filename])
        return {
          name,
          source: 'installed package',
          sha256: sha256(filename),
          text: readFileSync(filename, 'utf8')
        }
      })
    if (!notices.length) {
      const supplement = supplementsManifest[identity]
      if (!supplement || supplement.license !== manifest.license)
        throw new Error(`Missing original license notice: ${identity}`)
      const filename = path.resolve(supplements, supplement.file)
      assertOwnedPaths(supplements, [filename])
      if (sha256(filename) !== supplement.sha256)
        throw new Error(`Changed supplemental notice: ${identity}`)
      notices.push({
        name: supplement.file,
        source: supplement.source,
        sha256: supplement.sha256,
        text: readFileSync(filename, 'utf8')
      })
    }
    if (notices.some((notice) => !notice.text.trim()))
      throw new Error(`Empty notice: ${identity}`)
    records.push({
      name: manifest.name,
      version: manifest.version,
      license: manifest.license,
      notices
    })
  }
  return records.sort((a, b) =>
    `${a.name}@${a.version}`.localeCompare(`${b.name}@${b.version}`)
  )
}
