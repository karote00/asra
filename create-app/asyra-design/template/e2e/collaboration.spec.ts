import { expect, test, type Page, type TestInfo } from '@playwright/test'
import { seedServerResponse } from './server-response-inbox'
import {
  createRectangle,
  createVectorPath,
  dragSelectedElementBy,
  getCanvasPosition,
  getContentsPanel,
  getElementCount,
  getPropertiesPanel,
  getSelectedElementClientCenter,
  pressGroupCommandShortcut,
  redo,
  undo,
  waitForAppReady
} from './test-utils'

const collaborationUrl = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}`

const profiledCollaborationUrl = (fileId: string) =>
  `${collaborationUrl(fileId)}&aiPerformance=profile`

const CRDT_COMPLETION_TIMEOUT_MS = 180_000
const CRDT_CASE_TIMEOUT_MS = 240_000
const CRDT_ACTION_UNDO_REDO_CASE_TIMEOUT_MS = 600_000

const requireAppUrl = (testInfo: TestInfo): string => {
  const appUrl = String(testInfo.project.use.baseURL ?? '')
  if (!appUrl) {
    throw new Error('Asyra Design App URL is unavailable')
  }
  return appUrl
}

const layerRow = (page: Page, elementId: string) =>
  page.getByTestId(`element-item-${elementId}`)

const getLayerIds = (page: Page): Promise<string[]> =>
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

const expectNoBrowserPersistenceEvidence = async (page: Page) => {
  const evidence = await getClientPersistenceEvidence(page)
  expect(evidence.captureCount).toBe(0)
  expect(evidence.saveCount).toBe(0)
}

const groupLayerIds = async (
  page: Page,
  elementIds: readonly string[]
): Promise<string> => {
  const contentsPanel = getContentsPanel(page)
  const panelBounds = await contentsPanel.boundingBox()
  if (!panelBounds) {
    throw new Error('Layers panel bounds are unavailable')
  }
  await page.mouse.click(
    panelBounds.x + panelBounds.width / 2,
    panelBounds.y + panelBounds.height - 50
  )
  await expect.poll(() => getSelectedIds(page)).toEqual([])

  await layerRow(page, elementIds[0]).click()
  await page.keyboard.down('Shift')
  try {
    for (const elementId of elementIds.slice(1)) {
      await layerRow(page, elementId).click()
    }
  } finally {
    await page.keyboard.up('Shift')
  }
  await pressGroupCommandShortcut(page, 'group')
  await expect.poll(() => getSelectedIds(page)).toHaveLength(1)
  return (await getSelectedIds(page))[0]
}

const waitForCollaboration = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(
        async () =>
          (await import('../src/testing/runtime-access'))
            .getActiveCollaborationHandle()
            ?.getStatus() ?? 'missing'
      )
    )
    .toBe('connected')
}

const getCanonicalSnapshot = (page: Page) =>
  page.evaluate(async () => {
    const runtimeAccess = await import('../src/testing/runtime-access')
    const profiledElements = runtimeAccess
      .getActiveAiDrawingPerformanceProfile()
      ?.readCanonicalElements()
    if (profiledElements) {
      return profiledElements
        .filter(({ type }) => type !== 'workspace')
        .map(({ computed, id, rendered, type }) => ({
          computed,
          id,
          rendered,
          type
        }))
        .sort((left, right) => left.id.localeCompare(right.id))
    }
    const elements = runtimeAccess.core?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) return []
    return Array.from(elements.entries())
      .filter(([, element]) => element.get?.('type') !== 'workspace')
      .map(([id, element]) => ({
        id,
        type: String(element.get?.('type') ?? ''),
        computed: element.getAllComputedData?.() ?? {},
        rendered: Boolean(
          runtimeAccess.core?.deps?.render?.getElementById?.(id)
        )
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
  })

interface SerializableDifference {
  readonly actorA: unknown
  readonly actorB: unknown
  readonly path: string
}

const findFirstSerializableDifference = (
  actorA: unknown,
  actorB: unknown,
  path = '$'
): SerializableDifference | null => {
  if (Object.is(actorA, actorB)) return null
  if (Array.isArray(actorA) && Array.isArray(actorB)) {
    if (actorA.length !== actorB.length) {
      return {
        actorA: { length: actorA.length },
        actorB: { length: actorB.length },
        path
      }
    }
    for (let index = 0; index < actorA.length; index += 1) {
      const difference = findFirstSerializableDifference(
        actorA[index],
        actorB[index],
        `${path}[${index}]`
      )
      if (difference) return difference
    }
    return null
  }
  if (
    actorA !== null &&
    actorB !== null &&
    typeof actorA === 'object' &&
    typeof actorB === 'object' &&
    !Array.isArray(actorA) &&
    !Array.isArray(actorB)
  ) {
    const actorARecord = actorA as Record<string, unknown>
    const actorBRecord = actorB as Record<string, unknown>
    const keys = [
      ...new Set([...Object.keys(actorARecord), ...Object.keys(actorBRecord)])
    ].sort((left, right) => left.localeCompare(right))
    for (const key of keys) {
      if (!(key in actorARecord) || !(key in actorBRecord)) {
        return {
          actorA: key in actorARecord ? actorARecord[key] : { missing: true },
          actorB: key in actorBRecord ? actorBRecord[key] : { missing: true },
          path: `${path}.${key}`
        }
      }
      const difference = findFirstSerializableDifference(
        actorARecord[key],
        actorBRecord[key],
        `${path}.${key}`
      )
      if (difference) return difference
    }
    return null
  }
  return { actorA, actorB, path }
}

const expectCanonicalSnapshotsToConverge = (
  actorA: Awaited<ReturnType<typeof getCanonicalSnapshot>>,
  actorB: Awaited<ReturnType<typeof getCanonicalSnapshot>>
) => {
  const difference = findFirstSerializableDifference(actorA, actorB)
  expect(
    difference,
    difference
      ? `Canonical snapshots diverged at ${difference.path}: ${JSON.stringify(
          difference
        )}`
      : undefined
  ).toBeNull()
}

const waitForCanonicalSnapshotsToConverge = async (
  actorA: Page,
  actorB: Page
) => {
  await expect
    .poll(
      async () =>
        findFirstSerializableDifference(
          await getCanonicalSnapshot(actorA),
          await getCanonicalSnapshot(actorB)
        ),
      { timeout: CRDT_COMPLETION_TIMEOUT_MS }
    )
    .toBeNull()
}

const getCanonicalStrokeIdentityViolations = (
  snapshot: Awaited<ReturnType<typeof getCanonicalSnapshot>>
) =>
  snapshot.flatMap(({ computed, id: elementId }) => {
    const strokes = (computed as { strokes?: unknown }).strokes
    if (!Array.isArray(strokes)) return []
    return strokes.flatMap((stroke, index) => {
      if (!stroke || typeof stroke !== 'object' || Array.isArray(stroke)) {
        return [{ elementId, fillId: null, index, strokeId: null }]
      }
      const strokeId = (stroke as { id?: unknown }).id
      const fill = (stroke as { fill?: unknown }).fill
      const fillId =
        fill && typeof fill === 'object' && !Array.isArray(fill)
          ? (fill as { id?: unknown }).id
          : undefined
      return typeof strokeId === 'string' &&
        strokeId.length > 0 &&
        fillId === strokeId
        ? []
        : [{ elementId, fillId: fillId ?? null, index, strokeId }]
    })
  })

const getCanonicalHierarchyGeometry = (page: Page) =>
  page.evaluate(async () => {
    const profiledElements = (await import('../src/testing/runtime-access'))
      .getActiveAiDrawingPerformanceProfile()
      ?.readCanonicalElements()
    const sceneTree = (await import('../src/testing/runtime-access')).core?.deps
      ?.sceneTree
    const elements = profiledElements
      ? profiledElements.map(({ computed, id, raw, type }) => ({
          computed,
          id,
          raw: raw as Record<string, unknown>,
          type
        }))
      : Array.from(sceneTree?.getAllElements?.().entries?.() ?? []).map(
          ([id, element]) => ({
            computed: element.getAllComputedData?.() ?? {},
            id,
            raw: element.save?.() ?? {},
            type: String(element.get?.('type') ?? '')
          })
        )
    const elementsById = new Map(
      elements.map((element) => [element.id, element])
    )

    const getFiniteNumber = (
      value: unknown,
      elementId: string,
      key: string
    ): number => {
      const result = Number(value)
      if (!Number.isFinite(result)) {
        throw new Error(
          `Element "${elementId}" has non-finite computed "${key}"`
        )
      }
      return result
    }

    const getWorldPosition = (elementId: string) => {
      let currentId = elementId
      let x = 0
      let y = 0
      const visited = new Set<string>()

      while (currentId) {
        if (visited.has(currentId)) {
          throw new Error(`Hierarchy cycle reaches "${currentId}"`)
        }
        visited.add(currentId)
        const element = elementsById.get(currentId)
        if (!element) {
          throw new Error(`Missing hierarchy element "${currentId}"`)
        }
        if (element.type === 'workspace') {
          break
        }
        const computed = element.computed as Record<string, unknown>
        x += getFiniteNumber(computed.x, currentId, 'x')
        y += getFiniteNumber(computed.y, currentId, 'y')
        currentId = String(element.raw.parentId ?? '')
      }

      return { x, y }
    }

    return elements
      .filter(({ type }) => type !== 'workspace')
      .map(({ computed: computedValue, id, raw, type }) => {
        const computed = computedValue as Record<string, unknown>
        const children = type === 'group' ? raw.children : undefined
        return {
          id,
          type,
          parentId: String(raw.parentId ?? ''),
          children: Array.isArray(children) ? [...children] : undefined,
          local: {
            x: getFiniteNumber(computed.x, id, 'x'),
            y: getFiniteNumber(computed.y, id, 'y'),
            width: getFiniteNumber(computed.width, id, 'width'),
            height: getFiniteNumber(computed.height, id, 'height')
          },
          world: getWorldPosition(id)
        }
      })
      .sort((left, right) => left.id.localeCompare(right.id))
  })

const getCollaborationDiagnostics = (page: Page) =>
  page.evaluate(async () => {
    const profiledElements = (await import('../src/testing/runtime-access'))
      .getActiveAiDrawingPerformanceProfile()
      ?.readCanonicalElements()
    return {
      status:
        (await import('../src/testing/runtime-access'))
          .getActiveCollaborationHandle()
          ?.getStatus() ?? 'missing',
      identity: (
        await import('../src/testing/runtime-access')
      ).getActiveCollaborationHandle()?.identity,
      canonicalElementCount: profiledElements
        ? profiledElements.filter(({ type }) => type !== 'workspace').length
        : Array.from(
            (
              await import('../src/testing/runtime-access')
            ).core?.deps?.sceneTree
              ?.getAllElements?.()
              .values?.() ?? []
          ).filter((element) => element.get?.('type') !== 'workspace').length
    }
  })

const getCanonicalRenderVisibility = (page: Page, elementId: string) =>
  page.evaluate(
    async (id) =>
      (
        await import('../src/testing/runtime-access')
      ).core?.deps?.render?.getElementById?.(id)?.visible ?? null,
    elementId
  )

const getOwnerSave = (page: Page) =>
  page.evaluate(
    async () =>
      (await import('../src/testing/runtime-access'))
        .getActiveAiDrawingPerformanceProfile()
        ?.readCanonicalOwnerSnapshot() ?? {
        sceneTree: (
          await import('../src/testing/runtime-access')
        ).core.deps.sceneTree.save(),
        props: (
          await import('../src/testing/runtime-access')
        ).core.deps.props.save()
      }
  )

const getCanonicalDocumentSave = (page: Page) =>
  page.evaluate(async () => {
    const profiledSnapshot = (await import('../src/testing/runtime-access'))
      .getActiveAiDrawingPerformanceProfile()
      ?.readCanonicalOwnerSnapshot()
    if (profiledSnapshot) return profiledSnapshot
    const sceneTree = (await import('../src/testing/runtime-access')).core.deps
      .sceneTree
    const sceneSave = sceneTree.save()
    const allProps = (
      await import('../src/testing/runtime-access')
    ).core.deps.props.save() as Record<string, Record<string, unknown>>
    const referencedPropertyIds = new Set<string>()
    const pendingPropertyIds: string[] = []
    const enqueuePropertyReferences = (value: unknown): void => {
      if (typeof value === 'string') {
        if (
          Object.prototype.hasOwnProperty.call(allProps, value) &&
          !referencedPropertyIds.has(value)
        ) {
          pendingPropertyIds.push(value)
        }
        return
      }
      if (Array.isArray(value)) {
        value.forEach(enqueuePropertyReferences)
        return
      }
      if (value && typeof value === 'object') {
        Object.values(value).forEach(enqueuePropertyReferences)
      }
    }

    Array.from(sceneTree.getAllElements().values()).forEach((element) => {
      if (element.get?.('type') === 'workspace') return
      enqueuePropertyReferences(element.save().props)
    })
    while (pendingPropertyIds.length > 0) {
      const propertyId = pendingPropertyIds.shift()
      if (!propertyId || referencedPropertyIds.has(propertyId)) continue
      referencedPropertyIds.add(propertyId)
      enqueuePropertyReferences(allProps[propertyId])
    }

    return {
      sceneTree: sceneSave,
      props: Object.fromEntries(
        [...referencedPropertyIds]
          .sort((left, right) => left.localeCompare(right))
          .map((propertyId) => [propertyId, allProps[propertyId]])
      )
    }
  })

const getUndoDepth = (page: Page) =>
  page.evaluate(async () => {
    const performanceProfile = (
      await import('../src/testing/runtime-access')
    ).getActiveAiDrawingPerformanceProfile()
    if (performanceProfile) return performanceProfile.readHistoryDepth()
    return (
      (
        (await import('../src/testing/runtime-access')).core.deps.factory
          .transact as unknown as {
          undoStack?: unknown[]
        }
      ).undoStack?.length ?? 0
    )
  })

const captureTransactionStatuses = (page: Page) =>
  page.evaluate(async () => {
    const performanceProfile = (
      await import('../src/testing/runtime-access')
    ).getActiveAiDrawingPerformanceProfile()
    if (performanceProfile) {
      performanceProfile.reset()
      return
    }
    const { core, testRuntimeState } = await import(
      '../src/testing/runtime-access'
    )
    const statuses = testRuntimeState.set<unknown[]>(
      'factory-transaction-statuses',
      []
    )
    core.deps.factory.subscribeToTransactionStatus((status) => {
      statuses.push({
        transactionId: status.transactionId,
        origin: status.origin,
        status: status.status,
        changeCount: status.changeCount,
        failure: status.failure,
        ...(status.error instanceof Error
          ? {
              error: {
                name: status.error.name,
                message: status.error.message,
                stack: status.error.stack
              }
            }
          : {})
      })
    })
  })

const getTransactionStatuses = (page: Page) =>
  page.evaluate(async () => {
    const performanceProfile = (
      await import('../src/testing/runtime-access')
    ).getActiveAiDrawingPerformanceProfile()
    if (performanceProfile) {
      return performanceProfile.getRuntimeEvidence().factoryStatuses
    }
    const { testRuntimeState } = await import('../src/testing/runtime-access')
    return testRuntimeState.get('factory-transaction-statuses') ?? []
  })

const captureFactoryPublicationShapes = (page: Page) =>
  page.evaluate(async () => {
    if (
      (
        await import('../src/testing/runtime-access')
      ).getActiveAiDrawingPerformanceProfile()
    )
      return
    const { core, testRuntimeState } = await import(
      '../src/testing/runtime-access'
    )
    const shapes = testRuntimeState.set<unknown[]>(
      'factory-publication-shapes',
      []
    )
    const publications = testRuntimeState.set<unknown[]>(
      'factory-publications',
      []
    )
    core.deps.factory.subscribeToSharedPublication((publication) => {
      publications.push(publication)
      shapes.push({
        publicationId: publication.publicationId,
        origin: publication.origin,
        mode: publication.mode,
        slices: publication.slices.map((slice) => ({
          orderedIds: slice.orderedIds,
          batches: slice.batches.map((batch) => ({
            channel: batch.channel,
            events: batch.deliveries.map((delivery) => {
              const payload =
                typeof delivery.payload === 'object' &&
                delivery.payload !== null &&
                !Array.isArray(delivery.payload)
                  ? (delivery.payload as Record<string, unknown>)
                  : {}
              return {
                eventName: delivery.eventName,
                action: payload.action,
                entryCount: Array.isArray(payload.entries)
                  ? payload.entries.length
                  : undefined,
                dataCount: Array.isArray(payload.data)
                  ? payload.data.length
                  : undefined,
                data: Array.isArray(payload.data)
                  ? payload.data.map((entry) =>
                      typeof entry === 'object' &&
                      entry !== null &&
                      !Array.isArray(entry)
                        ? {
                            id: (entry as Record<string, unknown>).id,
                            type: (entry as Record<string, unknown>).type
                          }
                        : entry
                    )
                  : undefined,
                id: payload.id,
                key: payload.key,
                ownerElementId: payload.ownerElementId,
                ownerPropertyName: payload.ownerPropertyName,
                orderedIds: delivery.orderedIds
              }
            })
          }))
        }))
      })
    })
  })

const getFactoryPublicationShapes = (page: Page) =>
  page.evaluate(async () => {
    const performanceProfile = (
      await import('../src/testing/runtime-access')
    ).getActiveAiDrawingPerformanceProfile()
    if (performanceProfile) {
      return performanceProfile.getRuntimeEvidence().factoryPublications
    }
    const { testRuntimeState } = await import('../src/testing/runtime-access')
    return testRuntimeState.get('factory-publication-shapes') ?? []
  })

const classifyFactoryPublicationsInApp = (page: Page) =>
  page.evaluate(async () => {
    const operationsModule = await import('/src/collaboration/operations.ts')
    const { testRuntimeState } = await import('../src/testing/runtime-access')
    const canonicalRequests: string[][] = []
    const processor = operationsModule.createPublicationProcessor({
      runRemoteTransaction: (mutate: () => void) => mutate(),
      decideRemotePublication: (publication) => publication,
      applyCanonicalChanges: (
        changes: readonly { readonly kind: string }[]
      ) => {
        canonicalRequests.push(changes.map(({ kind }) => kind))
      }
    })
    for (const publication of testRuntimeState.get<
      Parameters<typeof processor>[0][]
    >('factory-publications') ?? []) {
      processor(publication)
    }
    return canonicalRequests
  })

const capturePublicationOutcomes = (page: Page) =>
  page.evaluate(async () => {
    const { getActiveCollaborationHandle, testRuntimeState } = await import(
      '../src/testing/runtime-access'
    )
    const outcomes = testRuntimeState.set<unknown[]>(
      'remote-restore-outcomes',
      []
    )
    const handle = getActiveCollaborationHandle()
    handle?.observePublicationOutcomes((outcome) => {
      outcomes.push({
        ...outcome,
        ...(outcome.error instanceof Error
          ? {
              error: {
                name: outcome.error.name,
                message: outcome.error.message,
                stack: outcome.error.stack
              }
            }
          : {})
      })
    })
  })

const getPublicationOutcomes = (page: Page) =>
  page.evaluate(async () => {
    const { testRuntimeState } = await import('../src/testing/runtime-access')
    return testRuntimeState.get('remote-restore-outcomes') ?? []
  })

const getPublicationOutcomeIds = (
  page: Page,
  direction: string,
  status: string
) =>
  page.evaluate(
    async ({ expectedDirection, expectedStatus }) => {
      const { testRuntimeState } = await import('../src/testing/runtime-access')
      return (
        testRuntimeState.get<
          {
            direction: string
            publicationId: string
            status: string
          }[]
        >('remote-restore-outcomes') ?? []
      )
        .filter(
          (outcome) =>
            outcome.direction === expectedDirection &&
            outcome.status === expectedStatus
        )
        .map(({ publicationId }) => publicationId)
    },
    { expectedDirection: direction, expectedStatus: status }
  )

const getRemoteElementBatchEvidence = (page: Page) =>
  page.evaluate(async () => {
    const counters =
      (await import('../src/testing/runtime-access'))
        .getActiveAiDrawingPerformanceProfile()
        ?.snapshot().counters ?? []
    const sum = (name: string) =>
      counters
        .filter((counter) => counter.name === name)
        .reduce((total, counter) => total + counter.value, 0)
    return {
      batchCount: sum('collaboration:remote-add-element-batch-count'),
      batchedElementCount: sum('collaboration:remote-add-element-batch-size'),
      singleElementCount: sum('collaboration:remote-add-element-single-count')
    }
  })

const resetAiDrawingPerformanceEvidence = (page: Page) =>
  page.evaluate(async () => {
    const profile = (
      await import('../src/testing/runtime-access')
    ).getActiveAiDrawingPerformanceProfile()
    if (!profile) {
      throw new Error('AI drawing performance profile is unavailable')
    }
    profile.reset()
  })

const getClientPersistenceEvidence = (page: Page) =>
  page.evaluate(async () => {
    const phases =
      (await import('../src/testing/runtime-access'))
        .getActiveAiDrawingPerformanceProfile()
        ?.snapshot().phases ?? []
    const count = (name: string) =>
      phases.filter((phase) => phase.name === name).length
    return {
      captureCount: count('core:persistence-capture'),
      saveCount: count('core:persistence-save')
    }
  })

const getVectorTopologySummary = (page: Page) =>
  page.evaluate(async () => {
    const elements = (
      await import('../src/testing/runtime-access')
    ).core?.deps?.sceneTree?.getAllElements?.()
    if (!(elements instanceof Map)) return null
    const vector = Array.from(elements.values()).find(
      (element) => element.get?.('type') === 'vector'
    )
    const computed = vector?.getAllComputedData?.()
    if (!computed) return null
    const points = Object.values(computed.points ?? {}) as {
      kind?: unknown
    }[]
    const segments = Object.values(computed.segments ?? {}) as {
      inControlId?: unknown
      outControlId?: unknown
    }[]
    return {
      anchorCount: points.filter((point) => point.kind === 'anchor').length,
      controlCount: points.filter((point) => point.kind === 'control').length,
      segmentCount: segments.length,
      curvedSegmentCount: segments.filter(
        (segment) => segment.inControlId || segment.outControlId
      ).length
    }
  })

const expectSelectedElementInteriorToConverge = async (
  source: Page,
  peer: Page
) => {
  const center = await getSelectedElementClientCenter(source)
  if (!center) {
    throw new Error('Selected element center is unavailable for visual parity')
  }
  const clip = {
    x: Math.round(center.x - 10),
    y: Math.round(center.y - 10),
    width: 20,
    height: 20
  }
  const expected = (await source.screenshot({ clip })).toString('base64')

  await expect
    .poll(async () => (await peer.screenshot({ clip })).toString('base64'))
    .toBe(expected)
}

test('16-item server response keeps ordered minimal publications through one Action, Undo, and Redo', async ({
  page
}, testInfo) => {
  const fileId = `single-actor-fast-${Date.now()}-${testInfo.workerIndex}`
  await seedServerResponse(page.context(), {
    appUrl: requireAppUrl(testInfo),
    fileId,
    itemCount: 16
  })
  await page.goto(collaborationUrl(fileId))
  await waitForAppReady(page)
  await captureFactoryPublicationShapes(page)

  await page.getByTestId('ai-agent-toolbar-button').click()
  await expect(page.getByTestId('ai-agent-panel')).toBeVisible()
  await page
    .getByLabel('Message Agent')
    .fill('create the fast CRDT performance fixture')
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByTestId('ai-agent-message').last()).toHaveAttribute(
    'data-outcome',
    'success',
    { timeout: 30_000 }
  )
  await expect.poll(() => getElementCount(page)).toBe(17)

  await undo(page)
  await expect.poll(() => getElementCount(page)).toBe(0)
  await redo(page)
  await expect.poll(() => getElementCount(page)).toBe(17)

  const shapes = (await getFactoryPublicationShapes(page)) as {
    origin?: string
  }[]
  await testInfo.attach('fast-ai-factory-publication-shapes.json', {
    body: Buffer.from(JSON.stringify(shapes, null, 2)),
    contentType: 'application/json'
  })
  expect(shapes.map(({ origin }) => origin)).toEqual([
    ...Array.from({ length: 9 }, () => 'action'),
    ...Array.from({ length: 9 }, () => 'undo'),
    ...Array.from({ length: 9 }, () => 'redo')
  ])
  expect(JSON.stringify(shapes)).not.toMatch(
    /updateComputedData|updateComputedDataPatch/
  )

  expect(await classifyFactoryPublicationsInApp(page)).toEqual([
    ...Array.from({ length: 9 }, () => ['element-creation']),
    ...Array.from({ length: 9 }, () => ['element-removal']),
    ...Array.from({ length: 9 }, () => ['element-creation'])
  ])
})

test('16-item AI response converges through the ordinary two-actor publication path', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-fast-ai-crdt-${Date.now()}-${testInfo.workerIndex}`
  let checkpoint = 'contexts-created'
  const actorAContext = await browser.newContext()
  const actorBContext = await browser.newContext()
  const actorA = await actorAContext.newPage()
  const actorB = await actorBContext.newPage()

  try {
    await seedServerResponse(actorAContext, {
      appUrl: requireAppUrl(testInfo),
      fileId,
      itemCount: 16
    })
    await Promise.all([
      actorA.goto(profiledCollaborationUrl(fileId)),
      actorB.goto(profiledCollaborationUrl(fileId))
    ])
    await Promise.all([
      waitForAppReady(actorA),
      waitForAppReady(actorB),
      waitForCollaboration(actorA),
      waitForCollaboration(actorB)
    ])
    checkpoint = 'actors-ready'
    await Promise.all([
      capturePublicationOutcomes(actorA),
      capturePublicationOutcomes(actorB),
      captureTransactionStatuses(actorA),
      captureTransactionStatuses(actorB),
      captureFactoryPublicationShapes(actorA)
    ])

    const [actorAUndoDepthBefore, actorBUndoDepthBefore] = await Promise.all([
      getUndoDepth(actorA),
      getUndoDepth(actorB)
    ])
    await resetAiDrawingPerformanceEvidence(actorB)

    await actorA.getByTestId('ai-agent-toolbar-button').click()
    await expect(actorA.getByTestId('ai-agent-panel')).toBeVisible()
    await actorA
      .getByLabel('Message Agent')
      .fill('create the fast CRDT performance fixture')
    await actorA.getByRole('button', { name: 'Send' }).click()

    const settledTurn = actorA.getByTestId('ai-agent-message').last()
    await expect(settledTurn).toHaveAttribute('data-outcome', 'success', {
      timeout: 30_000
    })
    await expect.poll(() => getElementCount(actorA)).toBe(17)
    try {
      await expect.poll(() => getElementCount(actorB)).toBe(17)
    } catch (error) {
      throw new Error(
        `16-item AI peer convergence failed: ${JSON.stringify({
          batchEvidence: await getRemoteElementBatchEvidence(actorB),
          outcomes: await getPublicationOutcomes(actorB)
        })}`,
        { cause: error }
      )
    }
    checkpoint = 'initial-ai-convergence-complete'
    await actorA.getByTestId('ai-agent-toolbar-button').click()
    await expect(actorA.getByTestId('ai-agent-panel')).toBeHidden()
    checkpoint = 'agent-panel-closed-for-property-edit'

    const [
      actorASnapshot,
      actorBSnapshot,
      actorAHierarchy,
      actorBHierarchy,
      actorACanonicalSave,
      actorBCanonicalSave,
      actorAUndoDepthAfter,
      actorBUndoDepthAfter
    ] = await Promise.all([
      getCanonicalSnapshot(actorA),
      getCanonicalSnapshot(actorB),
      getCanonicalHierarchyGeometry(actorA),
      getCanonicalHierarchyGeometry(actorB),
      getCanonicalDocumentSave(actorA),
      getCanonicalDocumentSave(actorB),
      getUndoDepth(actorA),
      getUndoDepth(actorB)
    ])

    expect(actorASnapshot).toEqual(actorBSnapshot)
    expect(getCanonicalStrokeIdentityViolations(actorASnapshot)).toEqual([])
    expect(getCanonicalStrokeIdentityViolations(actorBSnapshot)).toEqual([])
    expect(actorAHierarchy).toEqual(actorBHierarchy)
    expect(actorACanonicalSave).toEqual(actorBCanonicalSave)
    expect(actorASnapshot.filter(({ type }) => type === 'group')).toHaveLength(
      1
    )
    expect(actorASnapshot.filter(({ type }) => type === 'vector')).toHaveLength(
      16
    )
    expect(actorASnapshot.every(({ rendered }) => rendered)).toBe(true)
    expect(actorAUndoDepthAfter).toBe(actorAUndoDepthBefore + 1)
    expect(actorBUndoDepthAfter).toBe(actorBUndoDepthBefore)
    expect(await getRemoteElementBatchEvidence(actorB)).toEqual({
      batchCount: expect.any(Number),
      batchedElementCount: 17,
      singleElementCount: 0
    })
    expect(
      (await getRemoteElementBatchEvidence(actorB)).batchCount
    ).toBeGreaterThan(0)
    expect(
      await getPublicationOutcomeIds(actorB, 'remote', 'processed')
    ).toEqual(await getPublicationOutcomeIds(actorA, 'local', 'sent'))
    expect(await getPublicationOutcomeIds(actorB, 'local', 'sent')).toEqual([])
    expect(
      await getPublicationOutcomeIds(actorA, 'remote', 'processed')
    ).toEqual([])

    const targetVector = actorASnapshot.find(({ type }) => type === 'vector')
    expect(targetVector).toBeDefined()
    if (!targetVector) {
      return
    }
    await layerRow(actorA, targetVector.id).click()
    const propertiesPanel = getPropertiesPanel(actorA)
    await propertiesPanel
      .getByTestId('prop-fill-color-picker-0-trigger')
      .click()
    const colorHexInput = actorA.getByTestId('prop-fill-color-picker-0-hex')
    const propertyUndoDepthBefore = await getUndoDepth(actorA)
    await colorHexInput.fill('44AAEE')
    await colorHexInput.press('Enter')

    await test.step('property change converges', () =>
      waitForCanonicalSnapshotsToConverge(actorA, actorB))
    checkpoint = 'property-change-converged'
    const propertySnapshot = await getCanonicalSnapshot(actorA)
    expect(
      (
        propertySnapshot.find(({ id }) => id === targetVector.id)?.computed as {
          fills?: { color?: string }[]
        }
      )?.fills?.[0]?.color
    ).toBe('#44aaee')
    expect(await getUndoDepth(actorA)).toBe(propertyUndoDepthBefore + 1)
    expect(await getUndoDepth(actorB)).toBe(actorBUndoDepthBefore)

    await undo(actorA)
    await test.step('property undo converges', () =>
      waitForCanonicalSnapshotsToConverge(actorA, actorB))
    checkpoint = 'property-undo-converged'
    expect(await getCanonicalSnapshot(actorA)).toEqual(actorASnapshot)
    await redo(actorA)
    await test.step('property redo converges', () =>
      waitForCanonicalSnapshotsToConverge(actorA, actorB))
    checkpoint = 'property-redo-converged'
    expect(await getCanonicalSnapshot(actorA)).toEqual(propertySnapshot)
    await undo(actorA)
    await test.step('property cleanup undo converges', () =>
      waitForCanonicalSnapshotsToConverge(actorA, actorB))
    checkpoint = 'property-cleanup-undo-converged'
    expect(await getCanonicalSnapshot(actorA)).toEqual(actorASnapshot)

    await test.step('selection history undo leaves canonical data unchanged', async () => {
      await undo(actorA)
      await expect
        .poll(() => getCanonicalSnapshot(actorA))
        .toEqual(actorASnapshot)
      await expect
        .poll(() => getCanonicalSnapshot(actorB))
        .toEqual(actorASnapshot)
    })

    await Promise.all([
      expectNoBrowserPersistenceEvidence(actorA),
      expectNoBrowserPersistenceEvidence(actorB)
    ])
    checkpoint = 'property-persistence-evidence-complete'
    expect(await getPublicationOutcomes(actorA)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'process-failed' })
      ])
    )
    expect(await getPublicationOutcomes(actorB)).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'process-failed' })
      ])
    )

    await undo(actorA)
    try {
      await expect.poll(() => getElementCount(actorA)).toBe(0)
    } catch (error) {
      throw new Error(
        `16-item AI local Undo failed: ${JSON.stringify({
          actorATransactions: await getTransactionStatuses(actorA),
          actorACanonical: await getCollaborationDiagnostics(actorA),
          actorAElementCount: await getElementCount(actorA),
          actorAOutcomes: await getPublicationOutcomes(actorA)
        })}`,
        { cause: error }
      )
    }
    try {
      await expect.poll(() => getElementCount(actorB)).toBe(0)
    } catch (error) {
      throw new Error(
        `16-item AI peer Undo convergence failed: ${JSON.stringify({
          actorAOutcomes: await getPublicationOutcomes(actorA),
          actorAPublications: await getFactoryPublicationShapes(actorA),
          actorBOutcomes: await getPublicationOutcomes(actorB),
          actorBElementCount: await getElementCount(actorB)
        })}`,
        { cause: error }
      )
    }
    await Promise.all([
      expectNoBrowserPersistenceEvidence(actorA),
      expectNoBrowserPersistenceEvidence(actorB)
    ])
    checkpoint = 'ai-undo-persistence-evidence-complete'
    expect(await getUndoDepth(actorB)).toBe(actorBUndoDepthBefore)

    await redo(actorA)
    await expect
      .poll(() => getCanonicalSnapshot(actorA))
      .toEqual(actorASnapshot)
    try {
      await expect
        .poll(() => getCanonicalSnapshot(actorB))
        .toEqual(actorASnapshot)
    } catch (error) {
      throw new Error(
        `16-item AI peer Redo convergence failed: ${JSON.stringify({
          actorAOutcomes: await getPublicationOutcomes(actorA),
          actorAPublications: await getFactoryPublicationShapes(actorA),
          actorBOutcomes: await getPublicationOutcomes(actorB),
          actorBElementCount: await getElementCount(actorB)
        })}`,
        { cause: error }
      )
    }
    expect(await getCanonicalHierarchyGeometry(actorB)).toEqual(actorAHierarchy)
    expect(await getCanonicalDocumentSave(actorB)).toEqual(actorACanonicalSave)
    expect(await getUndoDepth(actorB)).toBe(actorBUndoDepthBefore)
    expect(await getPublicationOutcomeIds(actorB, 'local', 'sent')).toEqual([])
    expect(
      await getPublicationOutcomeIds(actorA, 'remote', 'processed')
    ).toEqual([])
    await Promise.all([
      expectNoBrowserPersistenceEvidence(actorA),
      expectNoBrowserPersistenceEvidence(actorB)
    ])
    checkpoint = 'ai-redo-persistence-evidence-complete'

    await test.step('Actor B reloads the origin-persisted canonical snapshot', async () => {
      checkpoint = 'actor-b-reload-started'
      await actorB.reload()
      checkpoint = 'actor-b-reload-navigation-complete'
      await waitForAppReady(actorB)
      checkpoint = 'actor-b-reload-app-ready'
      await waitForCollaboration(actorB)
      checkpoint = 'actor-b-reload-collaboration-ready'
      await expect
        .poll(() => getCanonicalSnapshot(actorB))
        .toEqual(actorASnapshot)
      checkpoint = 'actor-b-reload-snapshot-complete'
    })
  } finally {
    await testInfo.attach('16-item-last-checkpoint.txt', {
      body: Buffer.from(checkpoint),
      contentType: 'text/plain'
    })
    await Promise.allSettled([actorAContext.close(), actorBContext.close()])
  }
})

test('320-item AI response converges through the ordinary cooperative two-actor path', async ({
  browser
}, testInfo) => {
  testInfo.setTimeout(CRDT_ACTION_UNDO_REDO_CASE_TIMEOUT_MS)
  const fileId = `e2e-320-item-ai-crdt-${Date.now()}-${testInfo.workerIndex}`
  const actorAContext = await browser.newContext()
  const actorBContext = await browser.newContext()
  const actorA = await actorAContext.newPage()
  const actorB = await actorBContext.newPage()

  try {
    await seedServerResponse(actorAContext, {
      appUrl: requireAppUrl(testInfo),
      fileId,
      itemCount: 320
    })
    await Promise.all([
      actorA.goto(collaborationUrl(fileId)),
      actorB.goto(collaborationUrl(fileId))
    ])
    await Promise.all([
      waitForAppReady(actorA),
      waitForAppReady(actorB),
      waitForCollaboration(actorA),
      waitForCollaboration(actorB)
    ])

    const [actorAUndoDepthBefore, actorBUndoDepthBefore] = await Promise.all([
      getUndoDepth(actorA),
      getUndoDepth(actorB)
    ])
    const startedAt = Date.now()
    const getCanonicalCount = async (page: Page) =>
      (await getCollaborationDiagnostics(page)).canonicalElementCount
    const waitForFirstCanonical = async (page: Page) => {
      await expect
        .poll(() => getCanonicalCount(page), { timeout: 30_000 })
        .toBeGreaterThan(0)
      return Date.now() - startedAt
    }
    const waitForCompleteProjection = async (page: Page) => {
      await expect
        .poll(
          async () => {
            const snapshot = await getCanonicalSnapshot(page)
            return {
              canonicalCount: snapshot.length,
              renderedCount: snapshot.filter(({ rendered }) => rendered).length
            }
          },
          { timeout: CRDT_COMPLETION_TIMEOUT_MS }
        )
        .toEqual({
          canonicalCount: 321,
          renderedCount: 321
        })
      return Date.now() - startedAt
    }
    const actorAFirstVisible = waitForFirstCanonical(actorA)
    const actorBFirstVisible = waitForFirstCanonical(actorB)
    const actorAComplete = waitForCompleteProjection(actorA)
    const actorBComplete = waitForCompleteProjection(actorB)

    await actorA.getByTestId('ai-agent-toolbar-button').click()
    await expect(actorA.getByTestId('ai-agent-panel')).toBeVisible()
    await actorA
      .getByLabel('Message Agent')
      .fill('create the 320-item CRDT performance fixture')
    await actorA.getByRole('button', { name: 'Send' }).click()

    const settledTurn = actorA.getByTestId('ai-agent-message').last()
    await expect(settledTurn).toHaveAttribute('data-outcome', 'success', {
      timeout: CRDT_COMPLETION_TIMEOUT_MS
    })
    const [
      actorAFirstVisibleMs,
      actorBFirstVisibleMs,
      actorACompleteMs,
      actorBCompleteMs
    ] = await Promise.all([
      actorAFirstVisible,
      actorBFirstVisible,
      actorAComplete,
      actorBComplete
    ])
    await waitForCanonicalSnapshotsToConverge(actorA, actorB)
    const convergenceCompleteMs = Date.now() - startedAt

    const [
      actorASnapshot,
      actorBSnapshot,
      actorAHierarchy,
      actorBHierarchy,
      actorAUndoDepthAfter,
      actorBUndoDepthAfter
    ] = await Promise.all([
      getCanonicalSnapshot(actorA),
      getCanonicalSnapshot(actorB),
      getCanonicalHierarchyGeometry(actorA),
      getCanonicalHierarchyGeometry(actorB),
      getUndoDepth(actorA),
      getUndoDepth(actorB)
    ])

    expectCanonicalSnapshotsToConverge(actorASnapshot, actorBSnapshot)
    expect(
      JSON.stringify(actorAHierarchy) === JSON.stringify(actorBHierarchy)
    ).toBe(true)
    expect(actorASnapshot.filter(({ type }) => type === 'group')).toHaveLength(
      1
    )
    expect(actorASnapshot.filter(({ type }) => type === 'vector')).toHaveLength(
      320
    )
    expect(actorASnapshot.every(({ rendered }) => rendered)).toBe(true)
    expect(actorAUndoDepthAfter).toBe(actorAUndoDepthBefore + 1)
    expect(actorBUndoDepthAfter).toBe(actorBUndoDepthBefore)

    await testInfo.attach('320-item-ai-crdt-creation-timings.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            actorACompleteMs,
            actorAFirstVisibleMs,
            actorBCompleteMs,
            actorBFirstVisibleMs,
            convergenceCompleteMs
          },
          null,
          2
        )
      ),
      contentType: 'application/json'
    })

    const undoStartedAt = Date.now()
    await undo(actorA)
    await expect
      .poll(() => getCanonicalCount(actorA), {
        timeout: CRDT_COMPLETION_TIMEOUT_MS
      })
      .toBe(0)
    const actorAUndoCompleteMs = Date.now() - undoStartedAt
    await expect
      .poll(() => getCanonicalCount(actorB), {
        timeout: CRDT_COMPLETION_TIMEOUT_MS
      })
      .toBe(0)
    const actorBUndoCompleteMs = Date.now() - undoStartedAt
    expect(await getUndoDepth(actorB)).toBe(actorBUndoDepthBefore)

    const redoStartedAt = Date.now()
    await redo(actorA)
    await expect
      .poll(() => getCanonicalCount(actorA), {
        timeout: CRDT_COMPLETION_TIMEOUT_MS
      })
      .toBe(321)
    const actorARedoCompleteMs = Date.now() - redoStartedAt
    await expect
      .poll(() => getCanonicalCount(actorB), {
        timeout: CRDT_COMPLETION_TIMEOUT_MS
      })
      .toBe(321)
    await waitForCanonicalSnapshotsToConverge(actorA, actorB)
    const actorBRedoCompleteMs = Date.now() - redoStartedAt
    const [actorARedoneSnapshot, actorBRedoneSnapshot, actorBRedoneHierarchy] =
      await Promise.all([
        getCanonicalSnapshot(actorA),
        getCanonicalSnapshot(actorB),
        getCanonicalHierarchyGeometry(actorB)
      ])
    expectCanonicalSnapshotsToConverge(actorASnapshot, actorARedoneSnapshot)
    expectCanonicalSnapshotsToConverge(actorASnapshot, actorBRedoneSnapshot)
    expect(
      JSON.stringify(actorBRedoneHierarchy) === JSON.stringify(actorAHierarchy)
    ).toBe(true)
    expect(await getUndoDepth(actorB)).toBe(actorBUndoDepthBefore)

    await testInfo.attach('320-item-ai-crdt-timings.json', {
      body: Buffer.from(
        JSON.stringify(
          {
            actorACompleteMs,
            actorAFirstVisibleMs,
            actorARedoCompleteMs,
            actorAUndoCompleteMs,
            actorBCompleteMs,
            actorBFirstVisibleMs,
            actorBRedoCompleteMs,
            actorBUndoCompleteMs
          },
          null,
          2
        )
      ),
      contentType: 'application/json'
    })
  } finally {
    await Promise.all([actorAContext.close(), actorBContext.close()])
  }
})

test('1,280-item cat prefix measures ordinary cooperative two-actor creation', async ({
  browser
}, testInfo) => {
  testInfo.setTimeout(CRDT_CASE_TIMEOUT_MS)
  const fileId = `e2e-1280-item-cat-prefix-${Date.now()}-${testInfo.workerIndex}`
  const profiledUrl = profiledCollaborationUrl(fileId)
  const actorAContext = await browser.newContext()
  const actorBContext = await browser.newContext()
  const actorA = await actorAContext.newPage()
  const actorB = await actorBContext.newPage()

  try {
    await seedServerResponse(actorAContext, {
      appUrl: requireAppUrl(testInfo),
      fileId,
      itemCount: 1280
    })
    await Promise.all([actorA.goto(profiledUrl), actorB.goto(profiledUrl)])
    await Promise.all([
      waitForAppReady(actorA),
      waitForAppReady(actorB),
      waitForCollaboration(actorA),
      waitForCollaboration(actorB)
    ])
    await Promise.all([
      resetAiDrawingPerformanceEvidence(actorA),
      resetAiDrawingPerformanceEvidence(actorB)
    ])

    const getCanonicalCount = (page: Page) =>
      page.evaluate(async () => {
        const profile = (
          await import('../src/testing/runtime-access')
        ).getActiveAiDrawingPerformanceProfile()
        if (!profile) {
          throw new Error('AI drawing performance profile is unavailable')
        }
        return profile.readCanonicalElementCount()
      })
    const getAppliedRenderProjectionCount = (page: Page) =>
      page.evaluate(async () => {
        const profile = (
          await import('../src/testing/runtime-access')
        ).getActiveAiDrawingPerformanceProfile()
        if (!profile) {
          throw new Error('AI drawing performance profile is unavailable')
        }
        return profile.readCounterTotal('render-projection-outcome-applied')
      })
    const [
      actorAUndoDepthBefore,
      actorBUndoDepthBefore,
      actorACanonicalBaseline,
      actorBCanonicalBaseline
    ] = await Promise.all([
      getUndoDepth(actorA),
      getUndoDepth(actorB),
      getCanonicalCount(actorA),
      getCanonicalCount(actorB)
    ])

    let startedAt = 0
    const waitForFirstVector = async (
      page: Page,
      canonicalBaseline: number
    ) => {
      await expect
        .poll(() => getCanonicalCount(page), { timeout: 30_000 })
        .toBeGreaterThan(canonicalBaseline + 1)
      return Date.now() - startedAt
    }
    const waitForCompleteProjection = async (
      page: Page,
      canonicalBaseline: number
    ) => {
      await expect
        .poll(() => getCanonicalCount(page), {
          timeout: CRDT_COMPLETION_TIMEOUT_MS
        })
        .toBe(canonicalBaseline + 1281)
      const canonicalCompleteMs = Date.now() - startedAt
      await expect
        .poll(() => getAppliedRenderProjectionCount(page), {
          timeout: CRDT_COMPLETION_TIMEOUT_MS
        })
        .toBeGreaterThanOrEqual(1281)
      return {
        canonicalCompleteMs,
        renderedCompleteMs: Date.now() - startedAt
      }
    }
    const actorAFirstVector = waitForFirstVector(
      actorA,
      actorACanonicalBaseline
    )
    const actorBFirstVector = waitForFirstVector(
      actorB,
      actorBCanonicalBaseline
    )
    const actorAComplete = waitForCompleteProjection(
      actorA,
      actorACanonicalBaseline
    )
    const actorBComplete = waitForCompleteProjection(
      actorB,
      actorBCanonicalBaseline
    )

    await actorA.getByTestId('ai-agent-toolbar-button').click()
    await expect(actorA.getByTestId('ai-agent-panel')).toBeVisible()
    await actorA
      .getByLabel('Message Agent')
      .fill('create the 1280-item CRDT performance fixture')
    startedAt = Date.now()
    await actorA.getByRole('button', { name: 'Send' }).click()

    const settledTurn = actorA.getByTestId('ai-agent-message').last()
    await expect(settledTurn).toHaveAttribute('data-outcome', 'success', {
      timeout: CRDT_COMPLETION_TIMEOUT_MS
    })
    const actorATurnSettledMs = Date.now() - startedAt
    const [
      actorAFirstVectorMs,
      actorBFirstVectorMs,
      actorACompletion,
      actorBCompletion
    ] = await Promise.all([
      actorAFirstVector,
      actorBFirstVector,
      actorAComplete,
      actorBComplete
    ])
    await waitForCanonicalSnapshotsToConverge(actorA, actorB)
    const convergenceCompleteMs = Date.now() - startedAt

    const [
      actorASnapshot,
      actorBSnapshot,
      actorAHierarchy,
      actorBHierarchy,
      actorAUndoDepthAfter,
      actorBUndoDepthAfter
    ] = await Promise.all([
      getCanonicalSnapshot(actorA),
      getCanonicalSnapshot(actorB),
      getCanonicalHierarchyGeometry(actorA),
      getCanonicalHierarchyGeometry(actorB),
      getUndoDepth(actorA),
      getUndoDepth(actorB)
    ])
    const getPointCount = (
      snapshot: Awaited<ReturnType<typeof getCanonicalSnapshot>>
    ) =>
      snapshot.reduce((total, { computed, type }) => {
        if (type !== 'vector') return total
        const points = (computed as { points?: Record<string, unknown> }).points
        return total + (points ? Object.keys(points).length : 0)
      }, 0)

    expectCanonicalSnapshotsToConverge(actorASnapshot, actorBSnapshot)
    expect(
      JSON.stringify(actorAHierarchy) === JSON.stringify(actorBHierarchy)
    ).toBe(true)
    expect(actorASnapshot.filter(({ type }) => type === 'group')).toHaveLength(
      1
    )
    expect(actorASnapshot.filter(({ type }) => type === 'vector')).toHaveLength(
      1280
    )
    expect(actorASnapshot.every(({ rendered }) => rendered)).toBe(true)
    expect(getPointCount(actorASnapshot)).toBe(86_474)
    expect(getPointCount(actorBSnapshot)).toBe(86_474)
    expect(actorAUndoDepthAfter).toBe(actorAUndoDepthBefore + 1)
    expect(actorBUndoDepthAfter).toBe(actorBUndoDepthBefore)

    const timings = {
      actorACanonicalCompleteMs: actorACompletion.canonicalCompleteMs,
      actorAFirstVectorMs,
      actorARenderedCompleteMs: actorACompletion.renderedCompleteMs,
      actorATurnSettledMs,
      actorBCanonicalCompleteMs: actorBCompletion.canonicalCompleteMs,
      actorBFirstVectorMs,
      actorBRenderedCompleteMs: actorBCompletion.renderedCompleteMs,
      convergenceCompleteMs
    }
    testInfo.annotations.push({
      description: JSON.stringify(timings),
      type: '1,280-item CRDT timings'
    })
    await testInfo.attach('1280-item-cat-prefix-crdt-timings.json', {
      body: Buffer.from(JSON.stringify(timings, null, 2)),
      contentType: 'application/json'
    })
  } finally {
    await Promise.all([actorAContext.close(), actorBContext.close()])
  }
})

test('two real Asyra Design windows converge while connected and catch up through reconnect bootstrap', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-${Date.now()}-${testInfo.workerIndex}`
  const isolatedFileId = `${fileId}-isolated`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const isolatedContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()
  const isolated = await isolatedContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId)),
      isolated.goto(collaborationUrl(isolatedFileId))
    ])
    await Promise.all([
      waitForAppReady(first),
      waitForAppReady(second),
      waitForAppReady(isolated)
    ])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second),
      waitForCollaboration(isolated)
    ])
    await Promise.all([
      capturePublicationOutcomes(first),
      capturePublicationOutcomes(second),
      captureTransactionStatuses(first),
      captureTransactionStatuses(second),
      captureFactoryPublicationShapes(first)
    ])

    await createRectangle(first, 0.35, 0.35)
    try {
      await expect.poll(() => getElementCount(second)).toBe(1)
    } catch (error) {
      const diagnostics = {
        first: await getCollaborationDiagnostics(first),
        second: await getCollaborationDiagnostics(second)
      }
      await testInfo.attach('collaboration-diagnostics.json', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json'
      })
      throw error
    }
    expect(await getElementCount(isolated)).toBe(0)
    try {
      await expect
        .poll(() => getCanonicalSnapshot(second))
        .toEqual(await getCanonicalSnapshot(first))
    } catch (error) {
      const diagnostics = {
        first: await getCollaborationDiagnostics(first),
        second: await getCollaborationDiagnostics(second)
      }
      await testInfo.attach('canonical-convergence-diagnostics.json', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json'
      })
      throw error
    }
    await expectSelectedElementInteriorToConverge(first, second)
    expect(
      await second.evaluate(
        async () =>
          (
            await import('../src/testing/runtime-access')
          ).core?.deps?.selection?.getElementSelectionIds?.().length ?? 0
      )
    ).toBe(0)

    const unmovedSnapshot = await getCanonicalSnapshot(first)
    await dragSelectedElementBy(first, 90, 55, 12)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getElementCount(isolated)).toBe(0)

    const movedSnapshot = await getCanonicalSnapshot(first)
    expect(movedSnapshot).not.toEqual(unmovedSnapshot)
    await undo(first)
    await expect
      .poll(() => getCanonicalSnapshot(first))
      .toEqual(unmovedSnapshot)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(unmovedSnapshot)

    await redo(first)
    await expect.poll(() => getCanonicalSnapshot(first)).toEqual(movedSnapshot)
    await expect.poll(() => getCanonicalSnapshot(second)).toEqual(movedSnapshot)

    await first.keyboard.press('Delete')
    await expect.poll(() => getElementCount(first)).toBe(0)
    try {
      await expect.poll(() => getElementCount(second)).toBe(0)
    } catch (error) {
      const firstFactoryPublications = await getFactoryPublicationShapes(first)
      const firstOutcomes = await getPublicationOutcomes(first)
      const firstTransactions = await getTransactionStatuses(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const secondTransactions = await getTransactionStatuses(second)
      const diagnostics = {
        firstCollaboration: await getCollaborationDiagnostics(first),
        firstFactoryPublications: firstFactoryPublications.slice(-12),
        firstOutcomes: firstOutcomes.slice(-12),
        firstTransactions: firstTransactions.slice(-12),
        secondCollaboration: await getCollaborationDiagnostics(second),
        secondOutcomes: secondOutcomes.slice(-12),
        secondTransactions: secondTransactions.slice(-12)
      }
      await testInfo.attach('delete-convergence-diagnostics.json', {
        body: JSON.stringify(diagnostics, null, 2),
        contentType: 'application/json'
      })
      throw new Error(
        `Delete convergence failed: ${JSON.stringify(diagnostics)}`,
        { cause: error }
      )
    }
    expect(await getElementCount(isolated)).toBe(0)

    await second.evaluate(async () =>
      (await import('../src/testing/runtime-access'))
        .getActiveCollaborationHandle()
        ?.disconnect()
    )
    await expect
      .poll(() =>
        second.evaluate(
          async () =>
            (await import('../src/testing/runtime-access'))
              .getActiveCollaborationHandle()
              ?.getStatus() ?? 'missing'
        )
      )
      .toBe('disconnected')

    await createRectangle(first, 0.6, 0.55)
    await expect.poll(() => getElementCount(first)).toBe(1)
    expect(await getElementCount(second)).toBe(0)
    expect(await getElementCount(isolated)).toBe(0)

    await second.evaluate(async () =>
      (await import('../src/testing/runtime-access'))
        .getActiveCollaborationHandle()
        ?.reconnect()
    )
    await waitForCollaboration(second)
    await expect.poll(() => getElementCount(second)).toBe(1)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    await first.screenshot({
      path: testInfo.outputPath('actor-a-live-only.png'),
      fullPage: true
    })
    await second.screenshot({
      path: testInfo.outputPath('actor-b-live-only.png'),
      fullPage: true
    })
  } finally {
    await Promise.all([
      firstContext.close(),
      secondContext.close(),
      isolatedContext.close()
    ])
  }
})

test('remote undo restores an exact nested Group with and without local tombstones', async ({
  browser
}, testInfo) => {
  test.setTimeout(120_000)
  const fileId = `restore-${Date.now()}-${testInfo.workerIndex}`
  const senderContext = await browser.newContext()
  const tombstoneContext = await browser.newContext()
  const sender = await senderContext.newPage()
  const tombstonePeer = await tombstoneContext.newPage()
  let noTombstonePeer: Page | undefined

  try {
    await Promise.all([
      sender.goto(collaborationUrl(fileId)),
      tombstonePeer.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(sender), waitForAppReady(tombstonePeer)])
    await Promise.all([
      waitForCollaboration(sender),
      waitForCollaboration(tombstonePeer)
    ])

    await createRectangle(sender, 0.28, 0.32)
    await createRectangle(sender, 0.48, 0.45)
    await createRectangle(sender, 0.68, 0.58)
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(3)
    const rectangleIds = (await getCanonicalSnapshot(sender)).map(
      ({ id }) => id
    )
    const innerGroupId = await groupLayerIds(sender, rectangleIds.slice(0, 2))
    await sender.getByTestId(`layers-group-toggle-${innerGroupId}`).click()
    const outerGroupId = await groupLayerIds(sender, [
      rectangleIds[2],
      innerGroupId
    ])
    await sender.getByTestId(`layers-group-toggle-${innerGroupId}`).click()
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(5)
    await expect
      .poll(() => getOwnerSave(tombstonePeer))
      .toEqual(await getOwnerSave(sender))

    const expectedOwnerSave = await getOwnerSave(sender)
    const expectedLayerIds = await getLayerIds(sender)
    const expectedElementIds = (await getCanonicalSnapshot(sender)).map(
      ({ id }) => id
    )

    await layerRow(sender, outerGroupId).click()
    await sender.keyboard.press('Delete')
    await expect.poll(() => getElementCount(sender)).toBe(0)
    await expect.poll(() => getElementCount(tombstonePeer)).toBe(0)
    await expect
      .poll(() =>
        tombstonePeer.evaluate(async (expectedSceneCount) => {
          const sceneTree = (await import('../src/testing/runtime-access')).core
            .deps.sceneTree as unknown as {
            _deletedMap?: Map<string, unknown>
          }
          const props = (await import('../src/testing/runtime-access')).core
            .deps.props as unknown as {
            _deletedMap?: Map<string, unknown>
          }
          return (
            sceneTree._deletedMap?.size === expectedSceneCount &&
            (props._deletedMap?.size ?? 0) > 0
          )
        }, expectedElementIds.length)
      )
      .toBe(true)

    await expect
      .poll(
        () =>
          sender.evaluate(async (requestedFileId) => {
            const response = await fetch(
              `/api/documents/${encodeURIComponent(
                requestedFileId
              )}/bootstrap-checkpoint`
            )
            if (!response.ok) return null
            const payload = (await response.json()) as {
              checkpoint?: {
                props?: Record<string, unknown>
                sceneTree?: {
                  elements?: Record<string, unknown>
                }
              }
              durableSequence?: number
            }
            return {
              hasDurablePublication:
                typeof payload.durableSequence === 'number' &&
                payload.durableSequence > 0,
              elementCount: Object.keys(
                payload.checkpoint?.sceneTree?.elements ?? {}
              ).filter((elementId) => elementId !== 'workspace').length,
              propertyCount: Object.keys(payload.checkpoint?.props ?? {}).length
            }
          }, fileId),
        { timeout: 15_000 }
      )
      .toMatchObject({
        hasDurablePublication: true,
        elementCount: 0,
        propertyCount: 0
      })

    noTombstonePeer = await senderContext.newPage()
    await noTombstonePeer.goto(collaborationUrl(fileId))
    await waitForAppReady(noTombstonePeer)
    await waitForCollaboration(noTombstonePeer)
    expect(await getElementCount(noTombstonePeer)).toBe(0)
    expect(
      await noTombstonePeer.evaluate(async () => {
        const sceneTree = (await import('../src/testing/runtime-access')).core
          .deps.sceneTree as unknown as {
          _deletedMap?: Map<string, unknown>
        }
        const props = (await import('../src/testing/runtime-access')).core.deps
          .props as unknown as {
          _deletedMap?: Map<string, unknown>
        }
        return {
          scene: sceneTree._deletedMap?.size ?? 0,
          props: props._deletedMap?.size ?? 0
        }
      })
    ).toEqual({ scene: 0, props: 0 })

    await noTombstonePeer.evaluate(async () => {
      const { core, testRuntimeState } = await import(
        '../src/testing/runtime-access'
      )
      const publications = testRuntimeState.set<unknown[]>(
        'remote-restore-publications',
        []
      )
      const commits = testRuntimeState.set<unknown[]>(
        'remote-restore-commits',
        []
      )
      core.deps.factory.subscribeToSharedPublication((publication) =>
        publications.push(publication)
      )
      core.deps.factory.subscribeToTransactionStatus((status) => {
        if (status.origin === 'remote' && status.status === 'committed') {
          commits.push(status)
        }
      })
    })
    const noTombstoneUndoDepth = await getUndoDepth(noTombstonePeer)
    await Promise.all([
      capturePublicationOutcomes(tombstonePeer),
      capturePublicationOutcomes(noTombstonePeer)
    ])

    await undo(sender)
    await expect
      .poll(async () => (await getPublicationOutcomes(tombstonePeer)).length)
      .toBeGreaterThan(0)
    const remoteOutcomes = {
      tombstone: await getPublicationOutcomes(tombstonePeer),
      noTombstone: await getPublicationOutcomes(noTombstonePeer)
    }
    const processFailures = Object.values(remoteOutcomes)
      .flat()
      .filter(
        (outcome) =>
          typeof outcome === 'object' &&
          outcome !== null &&
          'status' in outcome &&
          outcome.status === 'process-failed'
      )
    if (processFailures.length > 0) {
      throw new Error(
        `Remote restore processing failed:\n${JSON.stringify(
          remoteOutcomes,
          null,
          2
        )}`
      )
    }

    try {
      await expect
        .poll(() => getOwnerSave(tombstonePeer))
        .toEqual(expectedOwnerSave)
    } catch (error) {
      await testInfo.attach('remote-restore-outcomes.json', {
        body: JSON.stringify(
          {
            tombstone: await getPublicationOutcomes(tombstonePeer),
            noTombstone: await getPublicationOutcomes(noTombstonePeer)
          },
          null,
          2
        ),
        contentType: 'application/json'
      })
      throw error
    }
    await expect
      .poll(() => getOwnerSave(noTombstonePeer as Page))
      .toEqual(expectedOwnerSave)
    await expect
      .poll(() => getLayerIds(tombstonePeer))
      .toEqual(expectedLayerIds)
    await expect
      .poll(() => getLayerIds(noTombstonePeer as Page))
      .toEqual(expectedLayerIds)
    await expect
      .poll(() => getCanonicalSnapshot(noTombstonePeer as Page))
      .toEqual(await getCanonicalSnapshot(sender))

    expect(await getUndoDepth(noTombstonePeer)).toBe(noTombstoneUndoDepth)
    expect(
      await noTombstonePeer.evaluate(async () => {
        const { testRuntimeState } = await import(
          '../src/testing/runtime-access'
        )
        return {
          publications:
            testRuntimeState.get<unknown[]>('remote-restore-publications')
              ?.length ?? -1,
          commits:
            testRuntimeState.get<unknown[]>('remote-restore-commits')?.length ??
            -1
        }
      })
    ).toEqual({ publications: 0, commits: 1 })

    for (const elementId of expectedElementIds) {
      expect(
        await getCanonicalRenderVisibility(noTombstonePeer, elementId)
      ).not.toBeNull()
    }

    await redo(sender)
    await expect.poll(() => getElementCount(sender)).toBe(0)
    try {
      await expect.poll(() => getElementCount(tombstonePeer)).toBe(0)
      await expect.poll(() => getElementCount(noTombstonePeer as Page)).toBe(0)
    } catch (error) {
      throw new Error(
        `Remote removal after restore failed: ${JSON.stringify({
          tombstone: (await getPublicationOutcomes(tombstonePeer)).slice(-8),
          noTombstone: (await getPublicationOutcomes(noTombstonePeer)).slice(-8)
        })}`,
        { cause: error }
      )
    }
    expect(await getUndoDepth(noTombstonePeer)).toBe(noTombstoneUndoDepth)
  } finally {
    await Promise.all([senderContext.close(), tombstoneContext.close()])
  }
})

test('remote Group redo preserves exact hierarchy and world geometry', async ({
  browser
}, testInfo) => {
  const fileId = `group-redo-${Date.now()}-${testInfo.workerIndex}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(first), waitForAppReady(second)])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second)
    ])
    await Promise.all([
      capturePublicationOutcomes(first),
      capturePublicationOutcomes(second),
      captureFactoryPublicationShapes(first)
    ])

    await createRectangle(first, 0.3, 0.35)
    await createRectangle(first, 0.62, 0.55)
    await expect.poll(() => getElementCount(second)).toBe(2)

    const rectangleIds = (await getCanonicalSnapshot(first)).map(({ id }) => id)
    const ungroupedGeometry = await getCanonicalHierarchyGeometry(first)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(ungroupedGeometry)

    const groupId = await groupLayerIds(first, rectangleIds)
    try {
      await expect.poll(() => getElementCount(second)).toBe(3)
    } catch (error) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const publications = await getFactoryPublicationShapes(first)
      const diagnostics = {
        firstOutcomes: firstOutcomes.slice(-12),
        publications: publications.slice(-12),
        secondOutcomes: secondOutcomes.slice(-12)
      }
      throw new Error(
        `Group convergence failed: ${JSON.stringify(diagnostics)}`,
        { cause: error }
      )
    }
    const groupedGeometry = await getCanonicalHierarchyGeometry(first)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(groupedGeometry)

    await undo(first)
    await expect.poll(() => getElementCount(first)).toBe(2)
    try {
      await expect.poll(() => getElementCount(second)).toBe(2)
    } catch (error) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const publications = await getFactoryPublicationShapes(first)
      const diagnostics = {
        firstOutcomes: firstOutcomes.slice(-12),
        publications: publications.slice(-12),
        secondOutcomes: secondOutcomes.slice(-12)
      }
      throw new Error(
        `Group Undo convergence failed: ${JSON.stringify(diagnostics)}`,
        { cause: error }
      )
    }
    await expect
      .poll(() => getCanonicalHierarchyGeometry(first))
      .toEqual(ungroupedGeometry)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(ungroupedGeometry)

    await redo(first)
    await expect.poll(() => getElementCount(first)).toBe(3)
    await expect.poll(() => getElementCount(second)).toBe(3)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(first))
      .toEqual(groupedGeometry)
    await expect
      .poll(() => getCanonicalHierarchyGeometry(second))
      .toEqual(groupedGeometry)

    const remoteGroup = (await getCanonicalHierarchyGeometry(second)).find(
      ({ id }) => id === groupId
    )
    expect(remoteGroup).toEqual(
      groupedGeometry.find(({ id }) => id === groupId)
    )
    await Promise.all([
      first.screenshot({
        path: testInfo.outputPath('group-redo-source.png'),
        fullPage: true
      }),
      second.screenshot({
        path: testInfo.outputPath('group-redo-peer.png'),
        fullPage: true
      })
    ])
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})

test('vector creation and anchor movement converge through the canonical collaboration pipeline', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-vector-${Date.now()}-${testInfo.workerIndex}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(first), waitForAppReady(second)])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second)
    ])
    await Promise.all([
      capturePublicationOutcomes(first),
      capturePublicationOutcomes(second),
      captureFactoryPublicationShapes(first)
    ])

    await createVectorPath(first, 0.32, 0.3, 0.18, 0.16)
    await expect.poll(() => getElementCount(second)).toBe(1)
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    await first.keyboard.press('Enter')
    const before = await first.evaluate(async () => {
      const core = (await import('../src/testing/runtime-access')).core
      const vectorId = core?.getSystemProperty?.('pathEditingVectorId')
      const computed = vectorId
        ? core?.deps?.sceneTree
            ?.getElementById?.(vectorId)
            ?.getAllComputedData?.()
        : undefined
      const anchor = Object.values(computed?.points ?? {}).find(
        (point) =>
          typeof point === 'object' && point !== null && point.kind === 'anchor'
      ) as { id: string; x: number; y: number } | undefined
      if (!vectorId || !anchor) {
        throw new Error('Created vector has no editable anchor')
      }
      const zoom = core?.getSystemProperty?.('zoom') ?? 1
      const viewport = core?.getSystemProperty?.('viewportPosition') ?? {
        x: 0,
        y: 0
      }
      const usesWorkspacePoints = computed?.pointCoordinateSpace === 'workspace'
      const offsetX = usesWorkspacePoints ? 0 : (computed?.x ?? 0)
      const offsetY = usesWorkspacePoints ? 0 : (computed?.y ?? 0)
      return {
        vectorId,
        pointId: anchor.id,
        point: { x: anchor.x, y: anchor.y },
        client: {
          x: (offsetX + anchor.x) * zoom + viewport.x,
          y: (offsetY + anchor.y) * zoom + viewport.y
        }
      }
    })

    const canonicalBefore = await getCanonicalSnapshot(first)

    await first.mouse.click(before.client.x, before.client.y)
    const pointXInput = getPropertiesPanel(first).getByTestId(
      'prop-vector-point-x'
    )
    await expect(pointXInput).toBeVisible()
    const [firstUndoDepthBefore, secondUndoDepthBefore] = await Promise.all([
      getUndoDepth(first),
      getUndoDepth(second)
    ])
    const nextX = before.point.x + 48
    await pointXInput.fill(String(nextX))
    await pointXInput.press('Enter')

    try {
      await waitForCanonicalSnapshotsToConverge(first, second)
    } catch (error) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const publications = await getFactoryPublicationShapes(first)
      const diagnostics = {
        firstOutcomes: firstOutcomes.slice(-12),
        publications: publications.slice(-12),
        secondOutcomes: secondOutcomes.slice(-12)
      }
      throw new Error(
        `Vector anchor convergence failed: ${JSON.stringify(diagnostics)}`,
        { cause: error }
      )
    }

    const remotePoint = await second.evaluate(async ({ vectorId, pointId }) => {
      const point = (
        await import('../src/testing/runtime-access')
      ).core?.deps?.sceneTree
        ?.getElementById?.(vectorId)
        ?.getAllComputedData?.()?.points?.[pointId]
      return point ? { x: point.x, y: point.y } : null
    }, before)
    expect(remotePoint).not.toBeNull()
    expect(remotePoint).toEqual({ x: nextX, y: before.point.y })
    expect(await getUndoDepth(first)).toBe(firstUndoDepthBefore + 1)
    expect(await getUndoDepth(second)).toBe(secondUndoDepthBefore)

    const canonicalAfter = await getCanonicalSnapshot(first)
    await undo(first)
    await waitForCanonicalSnapshotsToConverge(first, second)
    expect(await getCanonicalSnapshot(first)).toEqual(canonicalBefore)
    expect(await getUndoDepth(second)).toBe(secondUndoDepthBefore)

    await redo(first)
    await waitForCanonicalSnapshotsToConverge(first, second)
    expect(await getCanonicalSnapshot(first)).toEqual(canonicalAfter)
    expect(await getUndoDepth(second)).toBe(secondUndoDepthBefore)

    const remoteDocument = await second.evaluate(async () => {
      const saved = await (
        await import('../src/testing/runtime-access')
      ).core.save()
      return {
        version: saved.version,
        sceneTree: saved.sceneTree,
        props: saved.props
      }
    })
    await expect
      .poll(
        () =>
          second.evaluate(async (requestedFileId) => {
            const response = await fetch(
              `/api/documents/${encodeURIComponent(
                requestedFileId
              )}/bootstrap-checkpoint`,
              {
                credentials: 'same-origin',
                headers: { accept: 'application/json' }
              }
            )
            if (!response.ok) {
              throw new Error(
                `Document checkpoint load failed with status ${String(
                  response.status
                )}`
              )
            }
            return (
              (await response.json()) as {
                checkpoint?: unknown
              }
            ).checkpoint
          }, fileId),
        { message: 'backend checkpoint must match the canonical client save' }
      )
      .toEqual(remoteDocument)
    await second.reload()
    await waitForAppReady(second)
    await waitForCollaboration(second)
    expect(await getCanonicalSnapshot(second)).toEqual(canonicalAfter)
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})

test('mouse-down create and drag frames reach peer canonical state before pointer-up', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-return-origin-${Date.now()}-${testInfo.workerIndex}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(first), waitForAppReady(second)])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second)
    ])
    await first.keyboard.press('r')
    const createPosition = await getCanvasPosition(first, 0.35, 0.35)
    await first.mouse.move(createPosition.x, createPosition.y)
    await first.mouse.down()
    await expect.poll(() => getElementCount(second)).toBe(1)
    await first.mouse.up()
    await first.keyboard.press('v')
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    const clickCreated = (await getCanonicalSnapshot(second))[0]?.computed as
      | { width?: unknown; height?: unknown }
      | undefined
    expect(clickCreated?.width).toBe(100)
    expect(clickCreated?.height).toBe(100)

    const snapshot = await getCanonicalSnapshot(first)
    const elementId = snapshot[0]?.id
    const center = await getSelectedElementClientCenter(first)
    if (!elementId || !center) {
      throw new Error('move return-to-origin setup did not produce an element')
    }

    await first.mouse.move(center.x, center.y)
    await first.mouse.down()
    await first.mouse.move(center.x + 90, center.y + 55, { steps: 12 })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getCanonicalRenderVisibility(second, elementId)).toBe(true)

    await first.mouse.move(center.x, center.y, { steps: 12 })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    await first.mouse.up()

    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getCanonicalRenderVisibility(second, elementId)).toBe(true)
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})

test('pen drag-to-add publishes real topology and curve frames before pointer-up', async ({
  browser
}, testInfo) => {
  const fileId = `e2e-pen-drag-${Date.now()}-${testInfo.workerIndex}`
  const firstContext = await browser.newContext()
  const secondContext = await browser.newContext()
  const first = await firstContext.newPage()
  const second = await secondContext.newPage()
  const firstPageErrors: string[] = []
  first.on('pageerror', (error) => {
    firstPageErrors.push(error.message)
  })
  first.on('console', (message) => {
    if (message.type() === 'error') {
      firstPageErrors.push(message.text())
    }
  })

  try {
    await Promise.all([
      first.goto(collaborationUrl(fileId)),
      second.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(first), waitForAppReady(second)])
    await Promise.all([
      waitForCollaboration(first),
      waitForCollaboration(second)
    ])
    await Promise.all([
      capturePublicationOutcomes(first),
      capturePublicationOutcomes(second),
      captureFactoryPublicationShapes(first)
    ])

    const firstPoint = await getCanvasPosition(first, 0.3, 0.3)
    const secondPoint = await getCanvasPosition(first, 0.48, 0.45)
    const curveHandle = await getCanvasPosition(first, 0.58, 0.34)

    await first.keyboard.press('p')
    await first.mouse.click(firstPoint.x, firstPoint.y)
    await expect
      .poll(() => getVectorTopologySummary(second))
      .toMatchObject({
        anchorCount: 1,
        segmentCount: 0
      })
    const undoDepthBeforeDrag = await first.evaluate(
      async () =>
        (await import('../src/testing/runtime-access')).core?.deps?.factory
          ?.transact?.undoStack?.length ?? 0
    )

    await first.mouse.move(secondPoint.x, secondPoint.y)
    await first.mouse.down()
    try {
      await expect
        .poll(() => getVectorTopologySummary(second))
        .toMatchObject({
          anchorCount: 2,
          segmentCount: 1
        })
    } catch (error) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const publications = await getFactoryPublicationShapes(first)
      const diagnostics = {
        firstOutcomes: firstOutcomes.slice(-12),
        publications: publications.slice(-12),
        secondOutcomes: secondOutcomes.slice(-12)
      }
      throw new Error(
        `Pen topology convergence failed: ${JSON.stringify(diagnostics)}`,
        { cause: error }
      )
    }

    await first.mouse.move(curveHandle.x, curveHandle.y, { steps: 8 })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
    expect(await getVectorTopologySummary(second)).toMatchObject({
      anchorCount: 2,
      controlCount: 3,
      segmentCount: 1,
      curvedSegmentCount: 1
    })

    await first.mouse.up()
    try {
      await expect
        .poll(() => getCanonicalSnapshot(second))
        .toEqual(await getCanonicalSnapshot(first))
    } catch (error) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const publications = await getFactoryPublicationShapes(first)
      throw new Error(
        `Pen pointer-up convergence failed: ${JSON.stringify({
          firstOutcomes: firstOutcomes.slice(-16),
          publications: publications.slice(-16),
          secondOutcomes: secondOutcomes.slice(-16)
        })}`,
        { cause: error }
      )
    }
    const undoDepthAfterDrag = await first.evaluate(
      async () =>
        (await import('../src/testing/runtime-access')).core?.deps?.factory
          ?.transact?.undoStack?.length ?? 0
    )
    if (undoDepthAfterDrag !== undoDepthBeforeDrag + 1) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const publications = await getFactoryPublicationShapes(first)
      throw new Error(
        `Pen transaction did not create exactly one Undo entry: ${JSON.stringify(
          {
            actual: undoDepthAfterDrag,
            expected: undoDepthBeforeDrag + 1,
            firstPageErrors: firstPageErrors.slice(-8),
            firstOutcomes: firstOutcomes.slice(-16),
            publications: publications.slice(-16)
          }
        )}`
      )
    }

    await undo(first)
    await expect
      .poll(() => getVectorTopologySummary(second))
      .toMatchObject({
        anchorCount: 1,
        controlCount: 0,
        segmentCount: 0,
        curvedSegmentCount: 0
      })
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))

    await redo(first)
    try {
      await expect
        .poll(() => getVectorTopologySummary(second))
        .toMatchObject({
          anchorCount: 2,
          controlCount: 3,
          segmentCount: 1,
          curvedSegmentCount: 1
        })
    } catch (error) {
      const firstOutcomes = await getPublicationOutcomes(first)
      const secondOutcomes = await getPublicationOutcomes(second)
      const publications = await getFactoryPublicationShapes(first)
      throw new Error(
        `Pen Redo convergence failed: ${JSON.stringify({
          firstOutcomes: firstOutcomes.slice(-16),
          publications: publications.slice(-16),
          secondOutcomes: secondOutcomes.slice(-16)
        })}`,
        { cause: error }
      )
    }
    await expect
      .poll(() => getCanonicalSnapshot(second))
      .toEqual(await getCanonicalSnapshot(first))
  } finally {
    await Promise.all([firstContext.close(), secondContext.close()])
  }
})
