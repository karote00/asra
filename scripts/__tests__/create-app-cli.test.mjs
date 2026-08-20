import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
)

test('create-asyra-app exposes the one supported create command', () => {
  const rootManifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'create-app/asyra/package.json'),
      'utf8'
    )
  )

  assert.equal(manifest.bin, './bin/index.js')
  assert.deepEqual(
    Object.keys(rootManifest.scripts).filter((name) =>
      name.includes('create-asyra-app')
    ),
    []
  )

  const readme = fs.readFileSync(
    path.join(repositoryRoot, 'create-app/asyra/README.md'),
    'utf8'
  )
  const cli = fs.readFileSync(
    path.join(repositoryRoot, 'create-app/asyra/bin/index.js'),
    'utf8'
  )
  assert.match(readme, /npx create-asyra-app my-product/u)
  assert.doesNotMatch(readme, /yarn create-asyra-app/u)
  assert.match(cli, /Usage: npx create-asyra-app \[project-name\]/u)
})

test('create-asyra-app owns its 0.1.0 scaffold without a canonical app source', () => {
  const cliManifest = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, 'create-app/asyra/package.json'),
      'utf8'
    )
  )
  const repositoryManifest = JSON.parse(
    fs.readFileSync(path.join(repositoryRoot, 'package.json'), 'utf8')
  )
  const retiredAppName = `${repositoryManifest.name}-starter`
  const releaseConfigPath = path.join(
    repositoryRoot,
    'release-configs/create-asyra-app.json'
  )

  assert.equal(
    fs.existsSync(path.join(repositoryRoot, 'apps', retiredAppName)),
    false
  )
  assert.equal(fs.existsSync(releaseConfigPath), true)

  const releaseConfig = JSON.parse(fs.readFileSync(releaseConfigPath, 'utf8'))
  assert.equal(releaseConfig.src, 'create-app/asyra/source')
  assert.equal(releaseConfig.dest, 'create-app/asyra/template')
  assert.equal(releaseConfig.readme, 'create-app/asyra/source/TEMPLATE.md')

  const sourceManifest = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, releaseConfig.src, 'package.json'),
      'utf8'
    )
  )
  const templateManifest = JSON.parse(
    fs.readFileSync(
      path.join(repositoryRoot, releaseConfig.dest, 'package.json'),
      'utf8'
    )
  )

  assert.equal(cliManifest.version, '0.1.0')
  assert.equal(sourceManifest.version, cliManifest.version)
  assert.equal(templateManifest.version, cliManifest.version)
  assert.equal(JSON.stringify(sourceManifest).includes(retiredAppName), false)
  assert.equal(JSON.stringify(templateManifest).includes(retiredAppName), false)
})

const cliCases = [
  {
    args: ['--package-manager=yarn'],
    cliPath: 'create-app/asyra-design/bin/index.js',
    expectedUrl: 'http://localhost:3000/?fileId=my-design',
    requiredFiles: ['AGENTS.md', 'docs/README.md', 'docs/framework.md'],
    title: 'Asyra Design'
  },
  {
    args: [],
    cliPath: 'create-app/asyra/bin/index.js',
    expectedUrl: 'http://localhost:3000',
    requiredFiles: [
      '.gitignore',
      'AGENTS.md',
      'docs/framework.md',
      'src/framework-logo.svg'
    ],
    title: 'Asyra Framework'
  }
]

for (const cliCase of cliCases) {
  test(`successful ${cliCase.title} create-app output and files are complete`, () => {
    fs.mkdirSync(path.join(repositoryRoot, 'tmp'), { recursive: true })
    const testDirectory = fs.mkdtempSync(
      path.join(repositoryRoot, 'tmp', 'create-app-cli-output-')
    )
    const fakeBinDirectory = path.join(testDirectory, 'bin')
    const fakeYarnPath = path.join(fakeBinDirectory, 'yarn')
    const projectName = 'generated-app'

    try {
      fs.mkdirSync(fakeBinDirectory)
      fs.writeFileSync(
        fakeYarnPath,
        '#!/usr/bin/env node\nif (process.argv[2] === "--version") console.log("4.3.1")\n'
      )
      fs.chmodSync(fakeYarnPath, 0o755)

      const result = spawnSync(
        process.execPath,
        [
          path.join(repositoryRoot, cliCase.cliPath),
          projectName,
          ...cliCase.args
        ],
        {
          cwd: testDirectory,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${fakeBinDirectory}${path.delimiter}${process.env.PATH ?? ''}`
          }
        }
      )

      assert.equal(result.status, 0, result.stderr)
      const nextSteps = result.stdout.split('Next steps:')[1]
      assert.ok(nextSteps, result.stdout)
      assert.match(nextSteps, new RegExp(`cd ${projectName}`, 'u'))
      assert.doesNotMatch(nextSteps, /yarn install/u)
      assert.match(nextSteps, /yarn start/u)
      assert.ok(nextSteps.includes(cliCase.expectedUrl), nextSteps)
      for (const requiredFile of cliCase.requiredFiles) {
        assert.ok(
          fs.existsSync(path.join(testDirectory, projectName, requiredFile)),
          `${cliCase.title} output is missing ${requiredFile}`
        )
      }
      const generatedManifest = JSON.parse(
        fs.readFileSync(
          path.join(testDirectory, projectName, 'package.json'),
          'utf8'
        )
      )
      assert.equal(generatedManifest.packageManager, 'yarn@4.3.1')
      if (cliCase.title === 'Asyra Framework') {
        assert.equal(generatedManifest.name, projectName)
        assert.equal(generatedManifest.version, '0.1.0')
      }
    } finally {
      fs.rmSync(testDirectory, { recursive: true, force: true })
    }
  })
}
