import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type TestInfo,
  type Video
} from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { getTransactionSnapshot, waitForAppReady } from './test-utils'

interface CanonicalAiDrawingSnapshot {
  readonly blueStrokeIds: readonly string[]
  readonly groupCount: number
  readonly ids: readonly string[]
  readonly pointCount: number
  readonly redFillIds: readonly string[]
  readonly totalCount: number
  readonly vectorCount: number
  readonly whiteBackgrounds: readonly {
    readonly height: number
    readonly id: string
    readonly width: number
  }[]
}

interface TimelineEntry {
  readonly actorAElapsed: string
  readonly capturedAtMs: number
  readonly step: string
}

interface ProgressiveCreationEvidence {
  readonly observedElementCounts: readonly number[]
  readonly processedPublicationCount: number
}

interface CollaborationOutcomeEvidence {
  readonly direction: string
  readonly error?: {
    readonly message: string
    readonly name: string
  }
  readonly publicationId: string
  readonly status: string
}

interface FactoryPublicationEvidence {
  readonly deliveryCount: number
  readonly publicationId: string
  readonly sharedDeliveryModes: readonly string[]
}

const exactCatOnlyPrompt =
  'Draw only the cat from the reference image. Exclude the original background and place the cat on a pure white background canvas with exactly the same width and height as the uploaded photo.'
const referenceImageName = 'research-02-original-tabby-source.png'
const referenceImagePath = fileURLToPath(
  new URL(
    '../visual-review-records/research/research-02-original-tabby-source.png',
    import.meta.url
  )
)
const visualRecordDirectory = fileURLToPath(
  new URL('../visual-review-records/crdt-ai-agent/', import.meta.url)
)

const collaborationUrl = (fileId: string) =>
  `/?fileId=${encodeURIComponent(fileId)}&ai=mock&aiDelivery=progressive`

const prepareCompleteCatViewport = async (page: Page) => {
  const viewport = await page.locator('#viewport-anchor').boundingBox()
  if (!viewport) {
    throw new Error('The Asyra Design viewport bounds are unavailable')
  }
  const output = {
    height: 941,
    width: 1672,
    x: 0,
    y: 0
  }
  const padding = 32
  const scale = Math.min(
    (viewport.width - padding * 2) / output.width,
    (viewport.height - padding * 2) / output.height,
    1
  )
  const position = {
    x: viewport.x + (viewport.width - output.width * scale) / 2,
    y: viewport.y + (viewport.height - output.height * scale) / 2
  }
  await page.evaluate(
    ({ nextPosition, nextScale }) => {
      window.__Core__.setSystemProperty('zoom', nextScale)
      window.__Core__.setSystemProperty('viewportPosition', nextPosition)
    },
    {
      nextPosition: position,
      nextScale: scale
    }
  )
  await page.waitForTimeout(250)
  return { output, position, scale, viewport }
}

const waitForCollaboration = async (page: Page) => {
  await expect
    .poll(() =>
      page.evaluate(
        () => window.__AsyraCollaboration__?.getStatus() ?? 'missing'
      )
    )
    .toBe('connected')
}

const captureCollaborationOutcomes = async (page: Page) => {
  await page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __aiCrdtOutcomes?: CollaborationOutcomeEvidence[]
    }
    runtime.__aiCrdtOutcomes = []
    const collaboration = window.__AsyraCollaboration__ as
      | (NonNullable<Window['__AsyraCollaboration__']> & {
          observePublicationOutcomes(
            subscriber: (outcome: {
              direction: string
              error?: unknown
              publicationId: string
              status: string
            }) => void
          ): () => void
        })
      | undefined
    collaboration?.observePublicationOutcomes((outcome) => {
      runtime.__aiCrdtOutcomes?.push({
        direction: outcome.direction,
        ...(outcome.error instanceof Error
          ? {
              error: {
                message: outcome.error.message,
                name: outcome.error.name
              }
            }
          : {}),
        publicationId: outcome.publicationId,
        status: outcome.status
      })
    })
  })
}

const captureProgressiveRuntimeEvidence = async (page: Page) => {
  await page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __aiCreateDeliveryModes?: string[]
      __aiFactoryPublications?: FactoryPublicationEvidence[]
    }
    runtime.__aiCreateDeliveryModes = []
    runtime.__aiFactoryPublications = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = window as any
    const factory = scope.__Core__?.deps?.factory
    const elementApis = scope.__AsyraE2E__?.elementApis
    if (!factory || !elementApis) {
      throw new Error('Progressive runtime evidence owners are unavailable')
    }
    factory.subscribeToSharedPublication(
      (publication: {
        deliveries: readonly { sharedDelivery: string }[]
        publicationId: string
      }) => {
        runtime.__aiFactoryPublications?.push({
          deliveryCount: publication.deliveries.length,
          publicationId: publication.publicationId,
          sharedDeliveryModes: [
            ...new Set(
              publication.deliveries.map((delivery) => delivery.sharedDelivery)
            )
          ]
        })
      }
    )
    const originalCreateElements = elementApis.createElements.bind(elementApis)
    elementApis.createElements = (
      createOptions: readonly unknown[],
      options?: { sharedDelivery?: string }
    ) => {
      runtime.__aiCreateDeliveryModes?.push(
        options?.sharedDelivery ?? 'default'
      )
      return originalCreateElements(createOptions, options)
    }
  })
}

const getCollaborationDiagnostics = (page: Page) =>
  page.evaluate(() => {
    const runtime = globalThis as typeof globalThis & {
      __aiCreateDeliveryModes?: string[]
      __aiFactoryPublications?: FactoryPublicationEvidence[]
      __aiCrdtOutcomes?: CollaborationOutcomeEvidence[]
    }
    return {
      createDeliveryModes: runtime.__aiCreateDeliveryModes ?? [],
      factoryPublications: runtime.__aiFactoryPublications ?? [],
      outcomes: runtime.__aiCrdtOutcomes ?? [],
      status: window.__AsyraCollaboration__?.getStatus() ?? 'missing'
    }
  })

const getCanonicalAiDrawingSnapshot = (
  page: Page
): Promise<CanonicalAiDrawingSnapshot> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const scope = window as any
    const sceneTree = scope.__Core__?.deps?.sceneTree
    const elementApis = scope.__AsyraE2E__?.elementApis
    const strokeApis = scope.__AsyraE2E__?.strokeApis
    if (!sceneTree || !elementApis || !strokeApis) {
      throw new Error('Asyra Design E2E APIs are unavailable')
    }

    const blueStrokeIds: string[] = []
    const ids: string[] = []
    const redFillIds: string[] = []
    const whiteBackgrounds: {
      height: number
      id: string
      width: number
    }[] = []
    let groupCount = 0
    let pointCount = 0
    let vectorCount = 0

    for (const [id, element] of sceneTree.getAllElements().entries()) {
      const type = String(element.get('type'))
      if (type === 'workspace') {
        continue
      }
      ids.push(id)
      if (type === 'group') {
        groupCount += 1
      }
      if (type !== 'vector') {
        continue
      }
      vectorCount += 1
      const topology = elementApis.getVectorTopology(id)
      pointCount += topology ? Object.keys(topology.points).length : 0
      const computed = element.getAllComputedData()
      const primaryFill = computed?.fills?.[0]
      if (primaryFill?.color === '#DC2626') {
        redFillIds.push(id)
      }
      if (
        primaryFill?.color === '#FFFFFF' &&
        computed?.width === 1672 &&
        computed?.height === 941
      ) {
        whiteBackgrounds.push({
          height: computed.height,
          id,
          width: computed.width
        })
      }
      if (strokeApis.getPrimaryStrokeColor(id) === '#2563EB') {
        blueStrokeIds.push(id)
      }
    }

    return {
      blueStrokeIds: blueStrokeIds.sort(),
      groupCount,
      ids: ids.sort(),
      pointCount,
      redFillIds: redFillIds.sort(),
      totalCount: ids.length,
      vectorCount,
      whiteBackgrounds: whiteBackgrounds.sort((left, right) =>
        left.id.localeCompare(right.id)
      )
    }
  })

const getCanonicalElementCount = (page: Page): Promise<number> =>
  page.evaluate(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sceneTree = (window as any).__Core__?.deps?.sceneTree
    if (!sceneTree) {
      throw new Error('Asyra Design Scene Tree is unavailable')
    }
    let count = 0
    for (const element of sceneTree.getAllElements().values()) {
      if (String(element.get('type')) !== 'workspace') {
        count += 1
      }
    }
    return count
  })

const observeProgressiveCreation = async (
  actorA: Page,
  actorB: Page,
  isTurnSettled: () => boolean,
  timeout = 300_000
): Promise<ProgressiveCreationEvidence> => {
  const observedElementCounts: number[] = []
  const deadline = Date.now() + timeout

  while (Date.now() < deadline) {
    const [actorADiagnostics, actorBDiagnostics, actorBElementCount] =
      await Promise.all([
        getCollaborationDiagnostics(actorA),
        getCollaborationDiagnostics(actorB),
        getCanonicalElementCount(actorB)
      ])
    if (
      actorBElementCount > 0 &&
      actorBElementCount < 7076 &&
      observedElementCounts.at(-1) !== actorBElementCount
    ) {
      observedElementCounts.push(actorBElementCount)
    }
    const processedPublicationCount = actorBDiagnostics.outcomes.filter(
      ({ direction, status }) =>
        direction === 'remote' && status === 'processed'
    ).length
    if (
      !isTurnSettled() &&
      processedPublicationCount >= 2 &&
      observedElementCounts.length >= 2
    ) {
      return Object.freeze({
        observedElementCounts: Object.freeze([...observedElementCounts]),
        processedPublicationCount
      })
    }
    const failedOutcome = [
      ...actorADiagnostics.outcomes,
      ...actorBDiagnostics.outcomes
    ].find(
      ({ status }) => status === 'send-failed' || status === 'process-failed'
    )
    if (
      failedOutcome ||
      actorADiagnostics.status !== 'connected' ||
      actorBDiagnostics.status !== 'connected' ||
      isTurnSettled()
    ) {
      throw new Error(
        `Progressive creation did not expose multiple batches before settlement: ${JSON.stringify(
          {
            actorADiagnostics,
            actorBDiagnostics,
            actorBElementCount,
            turnSettled: isTurnSettled(),
            observedElementCounts
          }
        )}`
      )
    }
    await actorA.waitForTimeout(100)
  }

  throw new Error(
    `Progressive creation observation timed out: ${JSON.stringify({
      actorB: await getCollaborationDiagnostics(actorB),
      observedElementCounts
    })}`
  )
}

const openMockAi = async (page: Page) => {
  await page.getByRole('button', { name: 'Open Mock AI' }).click()
  await expect(page.getByTestId('mock-ai-panel')).toBeVisible()
  await expect(page.getByLabel('Message Agent')).toBeFocused()
}

const dropReferenceImage = async (page: Page) => {
  const imageBase64 = (await readFile(referenceImagePath)).toString('base64')
  const dataTransfer = await page.evaluateHandle(
    ({ base64, fileName }) => {
      const bytes = Uint8Array.from(globalThis.atob(base64), (character) =>
        character.charCodeAt(0)
      )
      const transfer = new DataTransfer()
      transfer.items.add(
        new File([bytes], fileName, {
          type: 'image/png'
        })
      )
      return transfer
    },
    {
      base64: imageBase64,
      fileName: referenceImageName
    }
  )
  try {
    const dropTarget = page.getByTestId('agent-image-drop-target')
    await dropTarget.dispatchEvent('dragenter', { dataTransfer })
    await dropTarget.dispatchEvent('dragover', { dataTransfer })
    await dropTarget.dispatchEvent('drop', { dataTransfer })
  } finally {
    await dataTransfer.dispose()
  }
  await expect(
    page.getByRole('img', {
      name: referenceImageName
    })
  ).toBeVisible()
}

const submitTurn = async (
  page: Page,
  intent: string,
  expectedSettledCount: number
) => {
  const input = page.getByLabel('Message Agent')
  await expect(input).toBeEnabled()
  await input.fill(intent)
  await page.getByRole('button', { name: 'Send' }).click()
  await expect(page.getByText('Working on your request')).toBeVisible()

  const settledTurns = page
    .getByTestId('mock-ai-panel')
    .locator('article[data-turn-id]')
  await expect(settledTurns).toHaveCount(expectedSettledCount, {
    timeout: 300_000
  })
  const turn = settledTurns.last()
  await expect(turn).toHaveAttribute('data-outcome', 'success')
  await expect(turn.getByText('Drawing updated successfully.')).toBeVisible()
  await expect(turn.getByText(/^Elapsed \d/)).toBeVisible()
  return turn
}

const expectPeerSnapshot = async (
  actorA: Page,
  actorB: Page,
  timeout = 300_000
) => {
  const expected = await getCanonicalAiDrawingSnapshot(actorA)
  const expectedSerialized = JSON.stringify(expected)
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const [peer, actorADiagnostics, actorBDiagnostics] = await Promise.all([
      getCanonicalAiDrawingSnapshot(actorB),
      getCollaborationDiagnostics(actorA),
      getCollaborationDiagnostics(actorB)
    ])
    if (JSON.stringify(peer) === expectedSerialized) {
      return expected
    }
    const failedOutcome = [
      ...actorADiagnostics.outcomes,
      ...actorBDiagnostics.outcomes
    ].find(
      ({ status }) => status === 'send-failed' || status === 'process-failed'
    )
    if (
      failedOutcome ||
      actorADiagnostics.status !== 'connected' ||
      actorBDiagnostics.status !== 'connected'
    ) {
      throw new Error(
        `CRDT publication failed before convergence: ${JSON.stringify({
          actorA: actorADiagnostics,
          actorB: actorBDiagnostics
        })}`
      )
    }
    await actorA.waitForTimeout(500)
  }
  throw new Error(
    `CRDT convergence timed out: ${JSON.stringify({
      actorA: await getCollaborationDiagnostics(actorA),
      actorB: await getCollaborationDiagnostics(actorB)
    })}`
  )
}

const captureCheckpoint = async (
  actorA: Page,
  actorB: Page,
  testInfo: TestInfo,
  name: string
) => {
  const actorAPath = `${visualRecordDirectory}${name}-actor-a.png`
  const actorBPath = `${visualRecordDirectory}${name}-actor-b.png`
  await Promise.all([
    actorA.screenshot({ path: actorAPath }),
    actorB.screenshot({ path: actorBPath })
  ])
  await Promise.all([
    testInfo.attach(`${name}-actor-a`, {
      contentType: 'image/png',
      path: actorAPath
    }),
    testInfo.attach(`${name}-actor-b`, {
      contentType: 'image/png',
      path: actorBPath
    })
  ])
}

const createSideBySideRecorder = async (
  context: BrowserContext,
  actorA: Page,
  actorB: Page
) => {
  const page = await context.newPage()
  await page.setContent(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; }
          html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #111827; }
          main { display: grid; grid-template-columns: 1fr 1fr; width: 100%; height: 100%; gap: 2px; }
          section { position: relative; min-width: 0; background: #0f172a; }
          img { display: block; width: 100%; height: 100%; object-fit: fill; }
          .actor {
            position: absolute; left: 16px; top: 16px; z-index: 2;
            padding: 7px 11px; border-radius: 999px;
            color: #fff; background: rgba(15, 23, 42, .88);
            font: 600 14px/1.2 ui-sans-serif, system-ui, sans-serif;
          }
          #status {
            position: fixed; z-index: 3; left: 50%; bottom: 18px; transform: translateX(-50%);
            min-width: 420px; padding: 10px 16px; border-radius: 10px;
            color: #fff; background: rgba(15, 23, 42, .92); text-align: center;
            font: 600 15px/1.3 ui-sans-serif, system-ui, sans-serif;
            box-shadow: 0 8px 28px rgba(0, 0, 0, .3);
          }
        </style>
      </head>
      <body>
        <main>
          <section><div class="actor">Actor A · Agent operator</div><img id="actor-a" /></section>
          <section><div class="actor">Actor B · CRDT peer</div><img id="actor-b" /></section>
        </main>
        <div id="status">Opening both Asyra Design clients…</div>
      </body>
    </html>
  `)

  let active = true
  let currentStep = 'Opening both Asyra Design clients…'
  const startedAt = Date.now()
  const refresh = async () => {
    while (active) {
      try {
        const [left, right] = await Promise.all([
          actorA.screenshot({ type: 'jpeg', quality: 68 }),
          actorB.screenshot({ type: 'jpeg', quality: 68 })
        ])
        await page.evaluate(
          ({ elapsedSeconds, leftSource, rightSource, step }) => {
            const leftImage =
              document.querySelector<HTMLImageElement>('#actor-a')
            const rightImage =
              document.querySelector<HTMLImageElement>('#actor-b')
            const status = document.querySelector<HTMLDivElement>('#status')
            if (leftImage) leftImage.src = leftSource
            if (rightImage) rightImage.src = rightSource
            if (status) {
              status.textContent = `${step} · ${elapsedSeconds.toFixed(1)}s`
            }
          },
          {
            elapsedSeconds: (Date.now() - startedAt) / 1000,
            leftSource: `data:image/jpeg;base64,${left.toString('base64')}`,
            rightSource: `data:image/jpeg;base64,${right.toString('base64')}`,
            step: currentStep
          }
        )
      } catch {
        // Navigation can briefly make a source page unavailable for capture.
      }
      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }
  const refreshPromise = refresh()

  return {
    page,
    setStep: (step: string) => {
      currentStep = step
    },
    stop: async () => {
      active = false
      await refreshPromise
      await page.waitForTimeout(750)
    }
  }
}

const saveVideo = async (
  context: BrowserContext,
  video: Video | null,
  destination: string
) => {
  await context.close()
  if (!video) {
    throw new Error('The side-by-side recorder did not expose a video')
  }
  await video.saveAs(destination)
}

test('records two live CRDT clients while Agent creates and incrementally edits the same cat', async ({
  browser
}, testInfo) => {
  test.skip(
    process.env.ASYRA_DESIGN_RUN_AI_CRDT_VIDEO !== '1',
    'The dual-client AI recording is an explicit resource-aware visual gate.'
  )
  test.setTimeout(900_000)
  await mkdir(visualRecordDirectory, { recursive: true })

  const actorAContext = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 }
  })
  const actorBContext = await browser.newContext({
    deviceScaleFactor: 1,
    viewport: { height: 720, width: 1280 }
  })
  const actorA = await actorAContext.newPage()
  const actorB = await actorBContext.newPage()
  const recorderContext = await browser.newContext({
    deviceScaleFactor: 1,
    recordVideo: {
      dir: testInfo.outputPath('side-by-side-video'),
      size: { height: 720, width: 2560 }
    },
    viewport: { height: 720, width: 2560 }
  })
  const recorder = await createSideBySideRecorder(
    recorderContext,
    actorA,
    actorB
  )
  const video = recorder.page.video()
  const videoPath = `${visualRecordDirectory}ai-cat-crdt-progressive-side-by-side.webm`
  const timeline: TimelineEntry[] = []
  let progressiveCreation: ProgressiveCreationEvidence | null = null

  try {
    const fileId = `ai-crdt-video-${Date.now()}`
    recorder.setStep('Opening Asyra Design in two independent actor contexts')
    await Promise.all([
      actorA.goto(collaborationUrl(fileId)),
      actorB.goto(collaborationUrl(fileId))
    ])
    await Promise.all([waitForAppReady(actorA), waitForAppReady(actorB)])
    await Promise.all([
      waitForCollaboration(actorA),
      waitForCollaboration(actorB)
    ])
    await Promise.all([
      captureCollaborationOutcomes(actorA),
      captureCollaborationOutcomes(actorB)
    ])
    await captureProgressiveRuntimeEvidence(actorA)

    recorder.setStep('Opening the Agent panel on Actor A')
    await openMockAi(actorA)
    recorder.setStep('Dragging the local tabby reference into the Agent panel')
    await dropReferenceImage(actorA)
    recorder.setStep('Framing the complete 1672 × 941 output before drawing')
    const [actorAFrame, actorBFrame] = await Promise.all([
      prepareCompleteCatViewport(actorA),
      prepareCompleteCatViewport(actorB)
    ])
    expect(actorAFrame.scale).toBeGreaterThan(0)
    expect(actorAFrame.scale).toBeLessThan(1)
    expect(actorBFrame.scale).toBeGreaterThan(0)
    expect(actorBFrame.scale).toBeLessThan(1)

    const actorABefore = await getTransactionSnapshot(actorA)
    const actorBBefore = await getTransactionSnapshot(actorB)
    recorder.setStep(
      'Drawing only the cat on a same-size pure white background'
    )
    const createdTurnPromise = submitTurn(actorA, exactCatOnlyPrompt, 1)
    let createdTurnSettled = false
    void createdTurnPromise.then(
      () => {
        createdTurnSettled = true
      },
      () => {
        createdTurnSettled = true
      }
    )
    void createdTurnPromise.catch(() => undefined)
    progressiveCreation = await observeProgressiveCreation(
      actorA,
      actorB,
      () => createdTurnSettled
    )
    recorder.setStep(
      `Peer is drawing progressively across ${progressiveCreation.processedPublicationCount} canonical publications`
    )
    await captureCheckpoint(
      actorA,
      actorB,
      testInfo,
      'progressive-00-in-progress'
    )
    const createdTurn = await createdTurnPromise
    const created = await expectPeerSnapshot(actorA, actorB, 600_000)
    expect(created).toMatchObject({
      groupCount: 1,
      totalCount: 7076,
      vectorCount: 7075
    })
    expect(created.pointCount).toBeGreaterThan(100_000)
    expect(created.whiteBackgrounds).toHaveLength(1)
    expect(created.whiteBackgrounds[0]).toMatchObject({
      height: 941,
      width: 1672
    })
    expect(created.blueStrokeIds).toEqual([])
    expect(created.redFillIds).toEqual([])
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorABefore.undoCount + 1
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBBefore.undoCount
    )
    timeline.push({
      actorAElapsed: await createdTurn.getByText(/^Elapsed \d/).innerText(),
      capturedAtMs: Date.now(),
      step: 'created'
    })
    recorder.setStep('Creation converged on both CRDT actors')
    await captureCheckpoint(actorA, actorB, testInfo, 'progressive-01-created')

    recorder.setStep('Changing the existing whiskers to blue')
    const whiskerTurn = await submitTurn(actorA, 'make the whiskers blue', 2)
    const blueWhiskers = await expectPeerSnapshot(actorA, actorB)
    expect(blueWhiskers.ids).toEqual(created.ids)
    expect(blueWhiskers.totalCount).toBe(created.totalCount)
    expect(blueWhiskers.pointCount).toBe(created.pointCount)
    expect(blueWhiskers.blueStrokeIds.length).toBeGreaterThanOrEqual(2)
    expect(blueWhiskers.redFillIds).toEqual([])
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorABefore.undoCount + 2
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBBefore.undoCount
    )
    timeline.push({
      actorAElapsed: await whiskerTurn.getByText(/^Elapsed \d/).innerText(),
      capturedAtMs: Date.now(),
      step: 'blue-whiskers'
    })
    recorder.setStep('Blue whiskers converged on both CRDT actors')
    await captureCheckpoint(
      actorA,
      actorB,
      testInfo,
      'progressive-02-blue-whiskers'
    )

    recorder.setStep('Changing the existing pupils to red')
    const pupilTurn = await submitTurn(actorA, 'make the pupils red', 3)
    const redPupils = await expectPeerSnapshot(actorA, actorB)
    expect(redPupils.ids).toEqual(created.ids)
    expect(redPupils.totalCount).toBe(created.totalCount)
    expect(redPupils.pointCount).toBe(created.pointCount)
    expect(redPupils.blueStrokeIds).toEqual(blueWhiskers.blueStrokeIds)
    expect(redPupils.redFillIds).toHaveLength(2)
    expect((await getTransactionSnapshot(actorA)).undoCount).toBe(
      actorABefore.undoCount + 3
    )
    expect((await getTransactionSnapshot(actorB)).undoCount).toBe(
      actorBBefore.undoCount
    )
    timeline.push({
      actorAElapsed: await pupilTurn.getByText(/^Elapsed \d/).innerText(),
      capturedAtMs: Date.now(),
      step: 'red-pupils'
    })
    recorder.setStep('Red pupils converged; ending the CRDT test')
    await captureCheckpoint(
      actorA,
      actorB,
      testInfo,
      'progressive-03-red-pupils'
    )
    await writeFile(
      `${visualRecordDirectory}progressive-timeline.json`,
      `${JSON.stringify({ progressiveCreation, timeline }, null, 2)}\n`,
      'utf8'
    )
  } finally {
    await recorder.stop()
    await saveVideo(recorderContext, video, videoPath)
    await Promise.all([actorAContext.close(), actorBContext.close()])
  }

  await testInfo.attach('ai-cat-crdt-progressive-side-by-side', {
    contentType: 'video/webm',
    path: videoPath
  })
})
