// @vitest-environment jsdom
import { expect, it, vi } from 'vitest'
import { downloadBytes } from '../download-project'

it('downloads an independent opaque byte attachment and revokes its URL without opening the file', async () => {
  const originalCreate = URL.createObjectURL

  const originalRevoke = URL.revokeObjectURL

  const originalClick = HTMLAnchorElement.prototype.click

  const create = vi.fn(() => 'blob:observation-download')

  const revoke = vi.fn()

  const clicks: { filename: string; href: string }[] = []

  URL.createObjectURL = create

  URL.revokeObjectURL = revoke

  HTMLAnchorElement.prototype.click = function () {
    clicks.push({ filename: this.download, href: this.href })
  }

  try {
    const bytes = new Uint8Array([0, 1, 97, 255])

    downloadBytes('observation.png', bytes, 'application/octet-stream')

    bytes.fill(0)

    const blob = (create.mock.calls[0] as unknown as [Blob])[0]

    expect(blob.type).toBe('application/octet-stream')

    const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader()

      reader.onload = () => resolve(reader.result as ArrayBuffer)

      reader.onerror = () => reject(reader.error)

      reader.readAsArrayBuffer(blob)
    })

    expect(Array.from(new Uint8Array(buffer))).toEqual([0, 1, 97, 255])

    expect(clicks).toEqual([
      { filename: 'observation.png', href: 'blob:observation-download' }
    ])

    expect(document.querySelector('a')).toBeNull()

    await vi.waitFor(() =>
      expect(revoke).toHaveBeenCalledWith('blob:observation-download')
    )
  } finally {
    URL.createObjectURL = originalCreate

    URL.revokeObjectURL = originalRevoke

    HTMLAnchorElement.prototype.click = originalClick
  }
})
