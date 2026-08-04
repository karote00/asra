import { exec } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import { createWorkspaceDevAllPlan } from './dev-all-plan.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

/**
 * Run a shell command in a given working directory
 * @param {string} cmd Command to execute
 * @param {string} cwd Working directory
 * @returns {Promise<void>}
 */
function runCommand(cmd, cwd) {
  return new Promise((resolve, reject) => {
    console.log(`Starting "${cmd}" in ${cwd} ...`)

    const proc = exec(cmd, { cwd })

    proc.stdout.on('data', (data) => {
      process.stdout.write(`[${path.basename(cwd)}] ${data}`)
    })

    proc.stderr.on('data', (data) => {
      process.stderr.write(`[${path.basename(cwd)} ERROR] ${data}`)
    })

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`Finished "${cmd}" in ${cwd}`)
        resolve()
      } else {
        reject(new Error(`Command failed with code ${code}: ${cmd} at ${cwd}`))
      }
    })
  })
}

/**
 * Run all dev scripts in parallel for listed packages + ui app
 */
async function runAll() {
  try {
    const plan = await createWorkspaceDevAllPlan(repoRoot)

    await Promise.all(
      [...plan.devProcesses, plan.app].map(({ dir, cmd }) => {
        return runCommand(cmd, path.resolve(repoRoot, dir))
      })
    )
  } catch (err) {
    console.error(err)
  }
}

runAll()
