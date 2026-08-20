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

test('the retired React-only starter surfaces stay removed', () => {
  const retiredCliName = ['create', 'asyra', 'app'].join('-')
  const retiredAppPath = ['apps', 'asyra'].join('/')
  const retiredCliPath = ['create-app', 'asyra'].join('/')
  const retiredConfigPath = ['release-configs', `${retiredCliName}.json`].join(
    '/'
  )

  for (const retiredPath of [
    retiredAppPath,
    retiredCliPath,
    retiredConfigPath
  ]) {
    assert.equal(
      fs.existsSync(path.join(repositoryRoot, retiredPath)),
      false,
      retiredPath
    )
  }

  for (const documentationPath of [
    'README.md',
    'docs/ai/framework/GETTING_STARTED.md',
    'docs/public/index.md',
    'docs/public/llms.txt'
  ]) {
    const source = fs.readFileSync(
      path.join(repositoryRoot, documentationPath),
      'utf8'
    )
    assert.equal(source.includes(retiredCliName), false)
    assert.equal(source.includes(`${retiredAppPath}/`), false)
  }

  const rootReadme = fs.readFileSync(
    path.join(repositoryRoot, 'README.md'),
    'utf8'
  )
  assert.match(rootReadme, /npm install @asyra\/core/u)
  assert.match(rootReadme, /npx create-asyra-design-app my-product/u)
})

const cliCases = [
  {
    args: ['--package-manager=yarn'],
    cliPath: 'create-app/asyra-design/bin/index.js',
    expectedUrl: 'http://localhost:3000/?fileId=my-design',
    forbiddenFiles: [],
    requiredFiles: ['AGENTS.md', 'docs/README.md', 'docs/framework.md'],
    title: 'Asyra Design'
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
      for (const forbiddenFile of cliCase.forbiddenFiles) {
        assert.equal(
          fs.existsSync(path.join(testDirectory, projectName, forbiddenFile)),
          false,
          `${cliCase.title} output includes ${forbiddenFile}`
        )
      }
      const generatedManifest = JSON.parse(
        fs.readFileSync(
          path.join(testDirectory, projectName, 'package.json'),
          'utf8'
        )
      )
      assert.equal(generatedManifest.packageManager, 'yarn@4.3.1')
    } finally {
      fs.rmSync(testDirectory, { recursive: true, force: true })
    }
  })
}
