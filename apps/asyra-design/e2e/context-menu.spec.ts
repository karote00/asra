import { writeFile } from 'node:fs/promises'
import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo
} from '@playwright/test'
import {
  createTestDocumentURL,
  createRectangle,
  getCanvasPosition,
  getContentsPanel,
  resetCanvas,
  waitForAppReady
} from './test-utils'

interface PlatformFixture {
  id: 'macos' | 'windows-linux'
  navigatorPlatform: string
  agentLabel: string
  groupLabel: string
  ungroupLabel: string
  groupShortcut: string
  ungroupShortcut: string
  visualPosition: 'center' | 'edge'
}

interface ClientRectSnapshot {
  left: number
  top: number
  right: number
  bottom: number
  width: number
  height: number
}

interface MenuRuntimeSnapshot {
  baseURL: string
  route: string
  platform: PlatformFixture['id']
  requested: { x: number; y: number }
  viewport: { width: number; height: number; deviceScaleFactor: number }
  zoom: number
  viewportPosition: { x: number; y: number }
  menuCount: number
  menu: ClientRectSnapshot
  focusedRowIndex: number
  rows: {
    label: string
    shortcut: string
    disabled: boolean
    rect: ClientRectSnapshot
    labelRect: ClientRectSnapshot
    shortcutRect: ClientRectSnapshot
  }[]
  selectedIds: string[]
  layerIds: string[]
  canonicalHash: string
}

interface OverlayMetrics {
  recall: number
  precisionLeakCount: number
  gapProbePassCount: number
  gapProbeCount: number
  perSourceCoverage: { label: string; coverage: number }[]
  drift: { x: number; y: number }
  duplicateMenuCount: number
  boundaryPass: boolean
  statePass: boolean
  failures: {
    category: string
    message: string
    sample?: { x: number; y: number }
  }[]
}

const platformFixtures: readonly PlatformFixture[] = [
  {
    id: 'macos',
    navigatorPlatform: 'MacIntel',
    agentLabel: '⌘I',
    groupLabel: '⌘G',
    ungroupLabel: '⇧⌘G',
    groupShortcut: 'Meta+G',
    ungroupShortcut: 'Meta+Shift+G',
    visualPosition: 'center'
  },
  {
    id: 'windows-linux',
    navigatorPlatform: 'Win32',
    agentLabel: 'Ctrl+I',
    groupLabel: 'Ctrl+G',
    ungroupLabel: 'Ctrl+Shift+G',
    groupShortcut: 'Control+G',
    ungroupShortcut: 'Control+Shift+G',
    visualPosition: 'edge'
  }
]

const hashText = (value: string): string => {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const installPlatformFixture = async (page: Page, fixture: PlatformFixture) => {
  await page.addInitScript((platform) => {
    Object.defineProperty(navigator, 'platform', {
      configurable: true,
      get: () => platform
    })
    Object.defineProperty(navigator, 'userAgentData', {
      configurable: true,
      get: () => ({ platform })
    })
  }, fixture.navigatorPlatform)
}

const getLayerIds = async (page: Page): Promise<string[]> =>
  getContentsPanel(page)
    .locator('[data-layer-element="true"]')
    .evaluateAll((rows) =>
      rows.map(
        (row) =>
          row.getAttribute('data-testid')?.replace('element-item-', '') ?? ''
      )
    )

const getSelectedIds = (page: Page): Promise<string[]> =>
  page.evaluate(
    async () =>
      (
        await import('../src/testing/runtime-access')
      ).core?.deps.selection.getElementSelectionIds() ?? []
  )

const selectLayers = async (page: Page, elementIds: readonly string[]) => {
  await page.getByTestId(`element-item-${elementIds[0]}`).click()
  await page.keyboard.down('Shift')
  try {
    for (const elementId of elementIds.slice(1)) {
      await page.getByTestId(`element-item-${elementId}`).click()
    }
  } finally {
    await page.keyboard.up('Shift')
  }
  await expect.poll(() => getSelectedIds(page)).toEqual(elementIds)
}

const getCanonicalSnapshot = async (
  page: Page,
  elementIds: readonly string[]
) =>
  page.evaluate(async (ids) => {
    const core = (await import('../src/testing/runtime-access')).core
    return {
      selectedIds: core.deps.selection.getElementSelectionIds(),
      elements: ids.map((id) => {
        const element = core.deps.sceneTree.getElementById(id)
        return {
          id,
          type: element?.get('type'),
          parentId: element?.get('parentId'),
          computed: element?.getAllComputedData?.() ?? null
        }
      })
    }
  }, elementIds)

const openContextMenu = async (
  page: Page,
  position: { x: number; y: number }
) => {
  await page.mouse.click(position.x, position.y, { button: 'right' })
  const menu = page.getByRole('menu', { name: 'Canvas commands' })
  await expect(menu).toBeVisible()
  return menu
}

const expectFixedRows = async (
  page: Page,
  menu: Locator,
  fixture: PlatformFixture
) => {
  await expect(page.getByTestId('layers-group-button')).toHaveCount(0)
  await expect(page.getByTestId('layers-ungroup-button')).toHaveCount(0)
  const rows = menu.getByRole('menuitem')
  await expect(rows).toHaveCount(3)
  await expect(rows.nth(0)).toHaveText(
    `Toggle Agent Panel${fixture.agentLabel}`
  )
  await expect(rows.nth(1)).toHaveText(`Group${fixture.groupLabel}`)
  await expect(rows.nth(2)).toHaveText(`Ungroup${fixture.ungroupLabel}`)
}

const captureRuleOverlay = async ({
  page,
  testInfo,
  fixture,
  requested,
  elementIds
}: {
  page: Page
  testInfo: TestInfo
  fixture: PlatformFixture
  requested: { x: number; y: number }
  elementIds: readonly string[]
}) => {
  const runtimeWithoutHash = await page.evaluate(
    async ({ expectedPlatform, requestedPosition, ids, currentBaseURL }) => {
      const toRect = (rect: DOMRect): ClientRectSnapshot => ({
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      })
      const menus = [...document.querySelectorAll<HTMLElement>('[role="menu"]')]
      const menu = menus[0]
      if (!menu) throw new Error('Visual review menu is unavailable')
      const rows = [
        ...menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')
      ]
      const core = (await import('../src/testing/runtime-access')).core

      return {
        baseURL: currentBaseURL,
        route: window.location.pathname,
        platform: expectedPlatform,
        requested: requestedPosition,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
          deviceScaleFactor: window.devicePixelRatio
        },
        zoom: Number(core.getSystemProperty('zoom') ?? 1),
        viewportPosition: (core.getSystemProperty('viewportPosition') ?? {
          x: 0,
          y: 0
        }) as { x: number; y: number },
        menuCount: menus.length,
        menu: toRect(menu.getBoundingClientRect()),
        focusedRowIndex: rows.findIndex(
          (row) => row === document.activeElement
        ),
        rows: rows.map((row) => {
          const label = row.querySelector<HTMLElement>(
            '[data-context-menu-label]'
          )
          const shortcut = row.querySelector<HTMLElement>(
            '[data-context-menu-shortcut]'
          )
          if (!label || !shortcut) {
            throw new Error('Visual review row parts are unavailable')
          }
          return {
            label: label.textContent ?? '',
            shortcut: shortcut.textContent ?? '',
            disabled: row.getAttribute('aria-disabled') === 'true',
            rect: toRect(row.getBoundingClientRect()),
            labelRect: toRect(label.getBoundingClientRect()),
            shortcutRect: toRect(shortcut.getBoundingClientRect())
          }
        }),
        selectedIds: core.deps.selection.getElementSelectionIds(),
        layerIds: ids,
        canonical: ids.map((id) => {
          const element = core.deps.sceneTree.getElementById(id)
          return {
            id,
            type: element?.get('type'),
            parentId: element?.get('parentId'),
            computed: element?.getAllComputedData?.() ?? null
          }
        })
      }
    },
    {
      expectedPlatform: fixture.id,
      requestedPosition: requested,
      ids: [...elementIds],
      currentBaseURL: String(testInfo.project.use.baseURL ?? '')
    }
  )
  const canonicalHash = hashText(JSON.stringify(runtimeWithoutHash.canonical))
  const runtime: MenuRuntimeSnapshot = {
    ...runtimeWithoutHash,
    canonicalHash
  }
  const plainPath = testInfo.outputPath(
    `context-menu-${fixture.id}-${fixture.visualPosition}.png`
  )
  const overlayPath = testInfo.outputPath(
    `context-menu-${fixture.id}-${fixture.visualPosition}-rule-overlay.png`
  )
  const metadataPath = testInfo.outputPath(
    `context-menu-${fixture.id}-${fixture.visualPosition}-metadata.json`
  )
  const plainScreenshot = await page.screenshot({ path: plainPath })
  const screenshotDataURL = `data:image/png;base64,${plainScreenshot.toString(
    'base64'
  )}`

  const overlayResult = await page.evaluate(
    async ({ screenshotURL, snapshot }) => {
      const image = new Image()
      image.src = screenshotURL
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d', { willReadFrequently: true })
      if (!context) throw new Error('Visual review canvas context unavailable')
      context.drawImage(image, 0, 0)

      const scaleX = canvas.width / snapshot.viewport.width
      const scaleY = canvas.height / snapshot.viewport.height
      const pixelAt = (x: number, y: number) => {
        const pixel = context.getImageData(
          Math.max(0, Math.min(canvas.width - 1, Math.round(x * scaleX))),
          Math.max(0, Math.min(canvas.height - 1, Math.round(y * scaleY))),
          1,
          1
        ).data
        return [pixel[0], pixel[1], pixel[2]]
      }
      const colorDistance = (actual: number[], expected: readonly number[]) =>
        Math.sqrt(
          actual.reduce(
            (sum, channel, index) =>
              sum + (channel - (expected[index] ?? 0)) ** 2,
            0
          )
        )
      const menuPalette = [
        [56, 56, 56],
        [68, 68, 68],
        [51, 51, 51]
      ] as const
      const isMenuPixel = (x: number, y: number) =>
        menuPalette.some((color) => colorDistance(pixelAt(x, y), color) <= 18)
      const sampleCoverage = (rect: ClientRectSnapshot) => {
        let matching = 0
        let total = 0
        for (let y = rect.top + 4; y < rect.bottom - 4; y += 4) {
          for (let x = rect.left + 4; x < rect.right - 4; x += 4) {
            total += 1
            if (isMenuPixel(x, y)) matching += 1
          }
        }
        return total === 0 ? 0 : matching / total
      }

      const expectedLeft = Math.min(
        Math.max(snapshot.requested.x, 0),
        Math.max(0, snapshot.viewport.width - snapshot.menu.width)
      )
      const expectedTop = Math.min(
        Math.max(snapshot.requested.y, 0),
        Math.max(0, snapshot.viewport.height - snapshot.menu.height)
      )
      const drift = {
        x: Math.abs(snapshot.menu.left - expectedLeft),
        y: Math.abs(snapshot.menu.top - expectedTop)
      }
      const perSourceCoverage = snapshot.rows.map((row) => ({
        label: row.label,
        coverage: sampleCoverage(row.rect)
      }))
      const recall =
        perSourceCoverage.reduce((sum, item) => sum + item.coverage, 0) /
        Math.max(1, perSourceCoverage.length)
      const gapProbes = snapshot.rows.map((row) => ({
        x: (row.labelRect.right + row.shortcutRect.left) / 2,
        y: row.rect.top + row.rect.height / 2
      }))
      const gapProbePassCount = gapProbes.filter(({ x, y }) =>
        isMenuPixel(x, y)
      ).length
      const forbiddenProbes = [
        {
          x: snapshot.menu.left - 12,
          y: snapshot.menu.top + snapshot.menu.height / 2
        },
        {
          x: snapshot.menu.right + 12,
          y: snapshot.menu.top + snapshot.menu.height / 2
        },
        {
          x: snapshot.menu.left + snapshot.menu.width / 2,
          y: snapshot.menu.top - 12
        },
        {
          x: snapshot.menu.left + snapshot.menu.width / 2,
          y: snapshot.menu.bottom + 12
        }
      ].filter(
        ({ x, y }) =>
          x >= 0 &&
          y >= 0 &&
          x < snapshot.viewport.width &&
          y < snapshot.viewport.height
      )
      const leakingProbes = forbiddenProbes.filter(({ x, y }) =>
        isMenuPixel(x, y)
      )
      const boundaryPass =
        snapshot.menu.left >= 0 &&
        snapshot.menu.top >= 0 &&
        snapshot.menu.right <= snapshot.viewport.width &&
        snapshot.menu.bottom <= snapshot.viewport.height &&
        drift.x <= 1 &&
        drift.y <= 1
      const expectedShortcuts =
        snapshot.platform === 'macos'
          ? ['⌘I', '⌘G', '⇧⌘G']
          : ['Ctrl+I', 'Ctrl+G', 'Ctrl+Shift+G']
      const statePass =
        snapshot.rows.length === 3 &&
        snapshot.rows[0]?.label === 'Toggle Agent Panel' &&
        snapshot.rows[1]?.label === 'Group' &&
        snapshot.rows[2]?.label === 'Ungroup' &&
        snapshot.rows.every(
          (row, index) => row.shortcut === expectedShortcuts[index]
        ) &&
        snapshot.rows[0]?.disabled === false &&
        snapshot.rows[1]?.disabled === false &&
        snapshot.rows[2]?.disabled === true &&
        snapshot.focusedRowIndex === 0 &&
        snapshot.rows.every(
          (row) => row.labelRect.right < row.shortcutRect.left
        )
      const failures: OverlayMetrics['failures'] = []
      perSourceCoverage.forEach((source) => {
        if (source.coverage < 0.55) {
          failures.push({
            category: 'source_dropout',
            message: `${source.label} pixel coverage ${source.coverage.toFixed(
              3
            )} is below 0.55`
          })
        }
      })
      if (recall < 0.65) {
        failures.push({
          category: 'missing_expected_output',
          message: `Menu pixel recall ${recall.toFixed(3)} is below 0.65`
        })
      }
      leakingProbes.forEach((sample) => {
        failures.push({
          category: 'forbidden_region_leak',
          message: 'Menu palette leaked into a forbidden outside probe',
          sample
        })
      })
      if (gapProbePassCount !== gapProbes.length) {
        failures.push({
          category: 'gap_leak',
          message: 'A label/shortcut gap did not retain menu background'
        })
      }
      if (!boundaryPass) {
        failures.push({
          category: 'model_render_drift',
          message: `Menu drift (${drift.x.toFixed(2)}, ${drift.y.toFixed(
            2
          )}) or viewport boundary failed`
        })
      }
      if (snapshot.menuCount !== 1) {
        failures.push({
          category: 'overdraw_or_double_render',
          message: `Expected one menu, received ${snapshot.menuCount}`
        })
      }
      if (!statePass) {
        failures.push({
          category: 'interaction_state_mismatch',
          message:
            'Row order, label layout, enabled state, or initial focus mismatched'
        })
      }

      context.setTransform(scaleX, 0, 0, scaleY, 0, 0)
      context.lineWidth = 1.5
      context.strokeStyle = '#00d9ff'
      context.fillStyle = 'rgba(0, 217, 255, 0.06)'
      context.fillRect(
        expectedLeft,
        expectedTop,
        snapshot.menu.width,
        snapshot.menu.height
      )
      context.strokeRect(
        expectedLeft,
        expectedTop,
        snapshot.menu.width,
        snapshot.menu.height
      )
      context.save()
      context.setLineDash([5, 4])
      context.strokeStyle = '#ff3bd4'
      context.strokeRect(
        snapshot.menu.left - 10,
        snapshot.menu.top - 10,
        snapshot.menu.width + 20,
        snapshot.menu.height + 20
      )
      context.restore()
      snapshot.rows.forEach((row, index) => {
        const sourcePass = (perSourceCoverage[index]?.coverage ?? 0) >= 0.55
        context.strokeStyle = sourcePass ? '#5cff85' : '#ff405a'
        context.strokeRect(
          row.rect.left,
          row.rect.top,
          row.rect.width,
          row.rect.height
        )
      })
      const drawProbe = (point: { x: number; y: number }, pass: boolean) => {
        context.beginPath()
        context.fillStyle = pass ? '#5cff85' : '#ff405a'
        context.arc(point.x, point.y, 3, 0, Math.PI * 2)
        context.fill()
      }
      gapProbes.forEach((point) =>
        drawProbe(point, isMenuPixel(point.x, point.y))
      )
      forbiddenProbes.forEach((point) =>
        drawProbe(point, !isMenuPixel(point.x, point.y))
      )
      context.strokeStyle = '#ffd84a'
      context.beginPath()
      context.moveTo(snapshot.requested.x - 6, snapshot.requested.y)
      context.lineTo(snapshot.requested.x + 6, snapshot.requested.y)
      context.moveTo(snapshot.requested.x, snapshot.requested.y - 6)
      context.lineTo(snapshot.requested.x, snapshot.requested.y + 6)
      context.stroke()
      failures.forEach((failure, index) => {
        const x = failure.sample?.x ?? snapshot.menu.right + 8
        const y =
          failure.sample?.y ?? snapshot.menu.top + 10 + Math.min(index, 6) * 8
        context.fillStyle = '#ff405a'
        context.fillRect(x - 3, y - 3, 6, 6)
      })
      context.fillStyle = 'rgba(10, 14, 18, 0.9)'
      context.fillRect(8, 8, 344, 70)
      context.fillStyle = '#ffffff'
      context.font = '11px sans-serif'
      context.fillText('cyan: expected menu  magenta: forbidden band', 16, 26)
      context.fillText('green/red: component + probes  yellow: pointer', 16, 43)
      context.fillText(
        `recall=${recall.toFixed(3)} leak=${leakingProbes.length} drift=${drift.x.toFixed(1)},${drift.y.toFixed(1)}`,
        16,
        60
      )

      return {
        overlayDataURL: canvas.toDataURL('image/png'),
        metrics: {
          recall,
          precisionLeakCount: leakingProbes.length,
          gapProbePassCount,
          gapProbeCount: gapProbes.length,
          perSourceCoverage,
          drift,
          duplicateMenuCount: Math.max(0, snapshot.menuCount - 1),
          boundaryPass,
          statePass,
          failures
        } satisfies OverlayMetrics
      }
    },
    {
      screenshotURL: screenshotDataURL,
      snapshot: runtime
    }
  )

  await writeFile(
    overlayPath,
    Buffer.from(overlayResult.overlayDataURL.split(',')[1] ?? '', 'base64')
  )
  await writeFile(
    metadataPath,
    JSON.stringify(
      {
        runtime,
        ruleInventory: {
          positive: [
            'one app-owned menu is visible',
            'Agent, Group, then Ungroup rows and platform shortcuts are visible',
            'each row has independent pixel coverage'
          ],
          negative: [
            'no second menu',
            'no menu-colored output in the forbidden outside probes',
            'no label/shortcut overlap'
          ],
          boundary: [
            'complete menu remains inside the visible viewport',
            'menu origin matches the deterministic pointer/clamp model'
          ],
          provenance: [
            'runtime menu DOM, selected ids, canonical layer ids, and canonical hash come from the captured app frame'
          ],
          state: [
            'Agent and Group enabled, Ungroup disabled, first enabled row focused'
          ],
          edgeCases: [
            `${fixture.visualPosition} pointer placement`,
            `${fixture.id} platform presentation`
          ],
          regressionRisks: [
            'row order drift',
            'platform label drift',
            'duplicate menu',
            'viewport clipping',
            'disabled-state mismatch'
          ]
        },
        thresholds: {
          recall: 0.65,
          perSourceCoverage: 0.55,
          forbiddenLeakCount: 0,
          gapProbeTolerance: 0,
          driftCssPixels: 1,
          duplicateMenuCount: 0
        },
        metrics: overlayResult.metrics
      },
      null,
      2
    )
  )
  await testInfo.attach('context-menu-rule-overlay', {
    path: overlayPath,
    contentType: 'image/png'
  })
  await testInfo.attach('context-menu-visual-metadata', {
    path: metadataPath,
    contentType: 'application/json'
  })

  expect(overlayResult.metrics.failures).toEqual([])
  return {
    plainPath,
    overlayPath,
    metadataPath,
    metrics: overlayResult.metrics
  }
}

for (const fixture of platformFixtures) {
  test.describe(`Group Context Menu (${fixture.id})`, () => {
    test.beforeEach(async ({ page }) => {
      await installPlatformFixture(page, fixture)
      await page.goto(createTestDocumentURL())
      await waitForAppReady(page)
      await resetCanvas(page)
    })

    test('keeps menu-only interaction non-mutating and routes menu plus actual shortcuts', async ({
      page
    }) => {
      await createRectangle(page, 0.35, 0.42)
      await createRectangle(page, 0.65, 0.58)
      const elementIds = await getLayerIds(page)
      expect(elementIds).toHaveLength(2)
      await selectLayers(page, elementIds)
      const beforeMenu = await getCanonicalSnapshot(page, elementIds)

      const nativeEventPrevented = await page
        .getByText('Layers', { exact: true })
        .evaluate(async (target) => {
          const event = new MouseEvent('contextmenu', {
            bubbles: true,
            cancelable: true,
            clientX: 20,
            clientY: 20
          })
          target.dispatchEvent(event)
          return event.defaultPrevented
        })
      expect(nativeEventPrevented).toBe(false)
      await expect(page.getByRole('menu')).toHaveCount(0)

      const center = await getCanvasPosition(page, 0.5, 0.5)
      const menu = await openContextMenu(page, center)
      await expectFixedRows(page, menu, fixture)
      const menuBounds = await menu.boundingBox()
      expect(menuBounds).not.toBeNull()
      expect(Math.abs((menuBounds?.x ?? 0) - center.x)).toBeLessThanOrEqual(1)
      expect(Math.abs((menuBounds?.y ?? 0) - center.y)).toBeLessThanOrEqual(1)
      await expect(
        menu.getByRole('menuitem', { name: 'Group', exact: true })
      ).toBeEnabled()
      const disabledUngroup = menu.getByRole('menuitem', {
        name: 'Ungroup',
        exact: true
      })
      await expect(disabledUngroup).toBeDisabled()
      await disabledUngroup.evaluate(async (row) =>
        (row as HTMLButtonElement).click()
      )
      await expect(menu).toBeVisible()
      expect(await getCanonicalSnapshot(page, elementIds)).toEqual(beforeMenu)

      await page.keyboard.press('Escape')
      await expect(menu).toHaveCount(0)
      expect(await getCanonicalSnapshot(page, elementIds)).toEqual(beforeMenu)

      await openContextMenu(page, center)
      await page.getByRole('menuitem', { name: 'Group', exact: true }).click()
      await expect(page.getByRole('menu')).toHaveCount(0)
      await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
      const menuGroupId = (await getSelectedIds(page))[0]
      await expect
        .poll(() =>
          page.evaluate(
            async (id) =>
              (
                await import('../src/testing/runtime-access')
              ).core?.deps.sceneTree
                .getElementById(id)
                ?.get('type') ?? null,
            menuGroupId
          )
        )
        .toBe('group')

      await openContextMenu(page, center)
      await page.getByRole('menuitem', { name: 'Ungroup', exact: true }).click()
      await expect.poll(() => getSelectedIds(page)).toEqual(elementIds)

      await page.keyboard.press(fixture.groupShortcut)
      await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
      const shortcutGroupId = (await getSelectedIds(page))[0]
      await expect
        .poll(() =>
          page.evaluate(
            async (id) =>
              (
                await import('../src/testing/runtime-access')
              ).core?.deps.sceneTree
                .getElementById(id)
                ?.get('type') ?? null,
            shortcutGroupId
          )
        )
        .toBe('group')

      await page.keyboard.press(fixture.ungroupShortcut)
      await expect.poll(() => getSelectedIds(page)).toEqual(elementIds)
      await expect(page.getByRole('menu')).toHaveCount(0)
    })

    test(`visual review produces a complete ${fixture.visualPosition} rule overlay`, async ({
      page
    }, testInfo) => {
      await createRectangle(page, 0.35, 0.42)
      await createRectangle(page, 0.65, 0.58)
      const elementIds = await getLayerIds(page)
      await selectLayers(page, elementIds)
      const requested =
        fixture.visualPosition === 'center'
          ? await getCanvasPosition(page, 0.5, 0.5)
          : await getCanvasPosition(page, 0.98, 0.98)
      const menu = await openContextMenu(page, requested)
      await expectFixedRows(page, menu, fixture)

      const result = await captureRuleOverlay({
        page,
        testInfo,
        fixture,
        requested,
        elementIds
      })
      expect(result.metrics.boundaryPass).toBe(true)
      expect(result.metrics.statePass).toBe(true)
      expect(result.metrics.precisionLeakCount).toBe(0)
      expect(result.metrics.duplicateMenuCount).toBe(0)
    })
  })
}
