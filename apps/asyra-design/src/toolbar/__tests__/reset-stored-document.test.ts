import { describe, expect, it, vi } from 'vitest'
import { resetStoredDocument } from '../reset-stored-document'

describe('independent stored-document Reset', () => {
  it('delegates the document barrier to Collaboration before reloading', async () => {
    window.history.replaceState({}, '', '/?fileId=file%2Fa')
    const resetDocument = vi.fn().mockResolvedValue(undefined)
    const reload = vi.fn()

    await resetStoredDocument({ reload, resetDocument })

    expect(resetDocument).toHaveBeenCalledWith('file/a')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads when the collaboration Reset barrier fails', async () => {
    window.history.replaceState({}, '', '/?fileId=document-a')
    const reload = vi.fn()
    const resetDocument = vi
      .fn()
      .mockRejectedValue(new Error('Reset barrier failed'))

    await expect(
      resetStoredDocument({ reload, resetDocument })
    ).rejects.toThrow('Reset barrier failed')
    expect(reload).toHaveBeenCalledOnce()
  })

  it('reloads the storage-free demo after local recovery cleanup', async () => {
    window.history.replaceState({}, '', '/?fileId=demo-document')
    const reload = vi.fn()
    const resetDocument = vi.fn().mockResolvedValue(undefined)

    await resetStoredDocument({ reload, resetDocument })

    expect(resetDocument).toHaveBeenCalledWith('demo-document')
    expect(reload).toHaveBeenCalledOnce()
  })
})
