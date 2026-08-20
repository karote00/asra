import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import path from 'node:path'
import { env } from 'node:process'
import test from 'node:test'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const siteRoot = path.resolve(import.meta.dirname, '..')
const localArtworkTest = env.LOCAL_ARTWORK_TESTS === '1' ? test : test.skip

const readStat = (stdout, key) => {
  const match = stdout.match(new RegExp(`^${key}=(\\d+)$`, 'm'))
  assert.ok(match, `Missing artwork stat: ${key}`)
  return Number(match[1])
}

localArtworkTest(
  'every complete card-to-card gap uses the same two-sided connector',
  async () => {
    const script = path.join(
      siteRoot,
      'artwork',
      'photoroom-refined',
      'draw-domain-rail-gap-component.py'
    )
    const { stdout } = await execFileAsync('python3', [script], {
      cwd: siteRoot
    })

    assert.match(stdout, /^full_exact_gap_matches=9$/m)
    assert.match(stdout, /^full_left_card_joint_matches=9$/m)
    assert.match(stdout, /^full_right_card_joint_matches=9$/m)
    assert.match(stdout, /^full_left_outer_connector_match=1$/m)
    assert.match(stdout, /^full_right_outer_connector_match=1$/m)
    assert.match(stdout, /^full_left_outer_rail_obstruction_pixels=0$/m)
    assert.match(stdout, /^full_right_outer_rail_obstruction_pixels=0$/m)
    assert.match(stdout, /^full_width=2400$/m)
    assert.match(stdout, /^full_height=325$/m)
  }
)

localArtworkTest(
  'outer connectors omit the upper and lower silver rails',
  async () => {
    const script = path.join(
      siteRoot,
      'artwork',
      'photoroom-refined',
      'extract-domain-rail-outer-connectors.py'
    )
    const { stdout } = await execFileAsync('python3', [script], {
      cwd: siteRoot
    })

    for (const side of ['left', 'right']) {
      assert.equal(readStat(stdout, `${side}_upper_silver_line_pixels`), 0)
      assert.equal(readStat(stdout, `${side}_lower_silver_line_pixels`), 0)
      assert.match(
        stdout,
        new RegExp(`^${side}_upper_dark_backing_pixels=0$`, 'm')
      )
      assert.match(
        stdout,
        new RegExp(`^${side}_lower_dark_backing_pixels=0$`, 'm')
      )
      assert.match(
        stdout,
        new RegExp(`^${side}_upper_dark_line_pixels=0$`, 'm')
      )
      assert.match(
        stdout,
        new RegExp(`^${side}_lower_dark_line_pixels=0$`, 'm')
      )
      assert.equal(readStat(stdout, `${side}_lower_rail_node_count`), 0)
      assert.equal(readStat(stdout, `${side}_upper_rail_obstruction_pixels`), 0)
      assert.equal(readStat(stdout, `${side}_lower_rail_obstruction_pixels`), 0)
      assert.equal(readStat(stdout, `${side}_upper_rail_cap_pixels`), 0)
      assert.equal(readStat(stdout, `${side}_lower_rail_nearby_dark_pixels`), 0)
      assert.equal(readStat(stdout, `${side}_upper_broad_dark_rows`), 0)
      assert.equal(readStat(stdout, `${side}_lower_broad_dark_rows`), 0)
    }
    assert.ok(readStat(stdout, 'left_upper_support_pixels') >= 500)
    assert.ok(readStat(stdout, 'right_upper_support_pixels') >= 350)
    assert.ok(readStat(stdout, 'left_outer_foot_pixels') >= 1150)
    assert.ok(readStat(stdout, 'left_card_foot_pixels') >= 1200)
    assert.ok(readStat(stdout, 'right_card_foot_pixels') >= 1000)
    assert.ok(readStat(stdout, 'right_outer_foot_pixels') >= 950)
  }
)
