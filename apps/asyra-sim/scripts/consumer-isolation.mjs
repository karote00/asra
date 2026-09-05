import { realpathSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/** Deny ancestor dependency reads without hiding or moving the developer's files. */
export function isolatedConsumerCommand(directory, command, args) {
  if (process.platform !== 'darwin')
    throw new Error(
      'Independent consumer isolation is currently verified only on macOS.'
    )
  const denied = []
  let ancestor = path.dirname(realpathSync(directory))
  while (true) {
    denied.push(path.join(ancestor, 'node_modules'))
    const parent = path.dirname(ancestor)
    if (parent === ancestor) break
    ancestor = parent
  }
  const profile = [
    '(version 1)',
    '(allow default)',
    ...denied.map(
      (directory) => `(deny file-read* (subpath ${JSON.stringify(directory)}))`
    )
  ].join('\n')
  return {
    command: '/usr/bin/sandbox-exec',
    args: ['-p', profile, command, ...args]
  }
}
