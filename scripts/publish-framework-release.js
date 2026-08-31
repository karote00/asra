#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { FRAMEWORK_RELEASE_PACKAGE_NAMES } from './framework-release-packages.js'

const planArgument = process.argv
  .slice(2)
  .find((arg) => arg.startsWith('--plan='))
const planPath = planArgument?.slice('--plan='.length)
if (!planPath) {
  console.error('Must specify --plan=<changeset-status.json>')
  process.exit(1)
}

const releasePlan = JSON.parse(fs.readFileSync(path.resolve(planPath), 'utf8'))
const allowedNames = new Set(FRAMEWORK_RELEASE_PACKAGE_NAMES)
const releases = releasePlan.releases.filter(({ type }) => type !== 'none')

if (releases.length === 0) {
  throw new Error('Framework release plan contains no publishable releases')
}
for (const release of releases) {
  if (!allowedNames.has(release.name)) {
    throw new Error(
      `Framework release plan contains forbidden package ${release.name}`
    )
  }
}

const releasesByName = new Map(
  releases.map((release) => [release.name, release])
)
const ordered = []
const visiting = new Set()
const visited = new Set()

const visit = (release) => {
  if (visited.has(release.name)) return
  if (visiting.has(release.name)) {
    throw new Error(`Framework release dependency cycle at ${release.name}`)
  }
  visiting.add(release.name)
  const directory = release.name.slice('@asyra/'.length)
  const manifest = JSON.parse(
    fs.readFileSync(path.resolve('packages', directory, 'package.json'), 'utf8')
  )
  if (manifest.version !== release.newVersion) {
    throw new Error(
      `${release.name} manifest ${manifest.version} does not match planned ${release.newVersion}`
    )
  }
  for (const dependencyName of Object.keys(manifest.dependencies ?? {})) {
    const dependencyRelease = releasesByName.get(dependencyName)
    if (dependencyRelease) visit(dependencyRelease)
  }
  visiting.delete(release.name)
  visited.add(release.name)
  ordered.push({ ...release, directory })
}

releases.forEach(visit)

for (const release of ordered) {
  execFileSync(
    'npm',
    ['publish', `./packages/${release.directory}`, '--access', 'public'],
    { stdio: 'inherit' }
  )
  execFileSync(
    'git',
    ['tag', `${release.name}@${release.newVersion}`, 'HEAD'],
    {
      stdio: 'inherit'
    }
  )
}
