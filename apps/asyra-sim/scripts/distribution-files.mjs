import { createHash } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

export const sha256 = (filename) =>
  createHash('sha256').update(readFileSync(filename)).digest('hex')

/** Enumerate immutable distribution inputs; never follow symbolic links. */
export function distributionFiles(directory) {
  const files = []
  let bytes = 0
  function visit(relative) {
    const filename = path.join(directory, relative)
    const stat = lstatSync(filename)
    if (stat.isSymbolicLink())
      throw new Error(`Distribution symlink: ${relative}`)
    if (stat.isDirectory()) {
      for (const name of readdirSync(filename).sort()) {
        if (
          name.includes('\\') ||
          [...name].some(
            (character) =>
              character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127
          )
        )
          throw new Error('Unsupported distribution filename.')
        visit(path.posix.join(relative, name))
      }
    } else if (stat.isFile()) {
      bytes += stat.size
      files.push(relative)
      if (files.length > 20000 || bytes > 512 * 1024 * 1024)
        throw new Error(
          'Distribution exceeds its 20,000-file / 512 MiB assembly limit.'
        )
    } else throw new Error(`Unsupported distribution input: ${relative}`)
  }
  visit('')
  return files
}

export function checksumText(directory) {
  return distributionFiles(directory)
    .filter((file) => file !== 'SHA256SUMS')
    .map((file) => `${sha256(path.join(directory, file))}  ${file}\n`)
    .join('')
}
