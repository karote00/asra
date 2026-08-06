import { describe, expect, it, vi } from 'vitest'
import { resetStoredDocument } from '../reset-stored-document'

describe('independent stored-document Reset', () => {
  it('deletes only the current stored file and reloads after success', async () => {
    window.history.replaceState({}, '', '/?fileId=file%2Fa')
    const fetchImplementation = vi.fn().mockResolvedValue({
      ok: true,
      status: 200
    })
    const reload = vi.fn()

    await resetStoredDocument({ fetchImplementation, reload })

    expect(fetchImplementation).toHaveBeenCalledWith(
      '/api/documents/file%2Fa',
      {
        headers: { accept: 'application/json' },
        method: 'DELETE'
      }
    )
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads when the stored-file endpoint rejects Reset', async () => {
    window.history.replaceState({}, '', '/?fileId=document-a')
    const fetchImplementation = vi.fn().mockResolvedValue({
      ok: false,
      status: 409
    })
    const reload = vi.fn()

    await expect(
      resetStoredDocument({ fetchImplementation, reload })
    ).rejects.toThrow('stored document Reset failed (409)')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads the storage-free demo when no backend connection exists', async () => {
    window.history.replaceState({}, '', '/?fileId=demo-document')
    const fetchImplementation = vi
      .fn()
      .mockRejectedValue(new TypeError('Failed to fetch'))
    const reload = vi.fn()

    await expect(
      resetStoredDocument({ fetchImplementation, reload })
    ).rejects.toThrow('Failed to fetch')
    expect(reload).toHaveBeenCalledOnce()
  })
})
