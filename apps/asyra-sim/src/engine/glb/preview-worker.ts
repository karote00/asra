import { GLB_LIMITS } from './schema'
import type { VisualAsset } from './decode'

interface WorkerResponse {
  id: number
  ok: boolean
  asset?: unknown
  error?: unknown
}

interface ActiveJob {
  worker: Worker
  reject: (error: Error) => void
}

type WorkerFactory = () => Worker

const defaultWorkerFactory: WorkerFactory = () =>
  new Worker(new URL('./preview.worker.ts', import.meta.url), {
    type: 'module'
  })

const abortError = (): DOMException =>
  new DOMException('GLB preview was cancelled', 'AbortError')

const finiteArray = (input: unknown, multiple: number): input is number[] =>
  Array.isArray(input) &&
  input.length % multiple === 0 &&
  input.every((value) => typeof value === 'number' && Number.isFinite(value))

function validateAsset(input: unknown): asserts input is VisualAsset {
  if (!input || typeof input !== 'object')
    throw new Error('Invalid GLB worker result')
  const asset = input as VisualAsset
  if (
    asset.format !== 'restricted-glb-v0' ||
    !asset.source ||
    !/^[a-f0-9]{64}$/.test(asset.source.sha256) ||
    !Number.isInteger(asset.source.byteLength) ||
    asset.source.byteLength < 1 ||
    asset.source.byteLength > GLB_LIMITS.bytes ||
    asset.source.lengthUnit !== 'm' ||
    !Array.isArray(asset.meshes) ||
    asset.meshes.length < 1 ||
    asset.meshes.length > GLB_LIMITS.primitives ||
    !asset.bounds ||
    !finiteArray(asset.bounds.min, 3) ||
    !finiteArray(asset.bounds.max, 3) ||
    asset.bounds.min.length !== 3 ||
    asset.bounds.max.length !== 3
  )
    throw new Error('Invalid GLB worker result')
  let vertices = 0,
    indices = 0
  for (const mesh of asset.meshes) {
    if (
      !mesh ||
      typeof mesh.name !== 'string' ||
      mesh.name.length > 200 ||
      !Number.isInteger(mesh.sourceNode) ||
      mesh.sourceNode < 0 ||
      !finiteArray(mesh.positions, 3) ||
      mesh.positions.length < 9 ||
      !Array.isArray(mesh.indices) ||
      mesh.indices.length < 3 ||
      mesh.indices.length % 3 !== 0 ||
      !mesh.indices.every(
        (index: unknown) =>
          typeof index === 'number' &&
          Number.isInteger(index) &&
          index >= 0 &&
          index < mesh.positions.length / 3
      ) ||
      !Number.isInteger(mesh.color) ||
      mesh.color < 0 ||
      mesh.color > 0xffffff ||
      !Number.isFinite(mesh.opacity) ||
      mesh.opacity < 0 ||
      mesh.opacity > 1
    )
      throw new Error('Invalid GLB worker result')
    vertices += mesh.positions.length / 3
    indices += mesh.indices.length
  }
  if (vertices > GLB_LIMITS.vertices || indices > GLB_LIMITS.indices)
    throw new Error('Invalid GLB worker result')
}

function deepFreeze<T>(input: T, seen = new WeakSet<object>()): T {
  if (!input || typeof input !== 'object' || seen.has(input)) return input
  seen.add(input)
  for (const value of Object.values(input)) deepFreeze(value, seen)
  return Object.freeze(input)
}

export class RestrictedGlbPreviewWorker {
  private nextId = 1
  private closed = false
  private readonly jobs = new Set<ActiveJob>()

  constructor(
    private readonly createWorker: WorkerFactory = defaultWorkerFactory
  ) {}

  decode(input: Uint8Array, signal?: AbortSignal): Promise<VisualAsset> {
    if (this.closed)
      return Promise.reject(new Error('GLB preview worker is closed'))
    if (signal?.aborted) return Promise.reject(abortError())
    const bytes = new Uint8Array(input),
      id = this.nextId++,
      worker = this.createWorker()
    return new Promise<VisualAsset>((resolve, reject) => {
      let settled = false
      const job: ActiveJob = { worker, reject: (error) => settle(error) }
      const settle = (error?: Error, asset?: VisualAsset) => {
        if (settled) return
        settled = true
        signal?.removeEventListener('abort', abort)
        worker.onmessage = null
        worker.onerror = null
        worker.terminate()
        this.jobs.delete(job)
        if (error) reject(error)
        else if (asset) resolve(asset)
        else reject(new Error('GLB preview returned no asset'))
      }
      const abort = () => settle(abortError())
      worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
        const response = event.data
        if (!response || response.id !== id) return
        if (!response.ok) {
          settle(
            new Error(
              typeof response.error === 'string'
                ? response.error
                : 'GLB preview worker failed'
            )
          )
          return
        }
        try {
          validateAsset(response.asset)
          settle(undefined, deepFreeze(structuredClone(response.asset)))
        } catch (error) {
          settle(
            error instanceof Error
              ? error
              : new Error('Invalid GLB worker result')
          )
        }
      }
      worker.onerror = (event) =>
        settle(new Error(event.message || 'GLB preview worker crashed'))
      signal?.addEventListener('abort', abort, { once: true })
      this.jobs.add(job)
      try {
        worker.postMessage({ id, bytes: bytes.buffer }, [bytes.buffer])
      } catch (error) {
        settle(
          error instanceof Error ? error : new Error('GLB worker start failed')
        )
      }
    })
  }

  dispose(): void {
    if (this.closed) return
    this.closed = true
    for (const job of [...this.jobs]) job.reject(abortError())
  }
}
