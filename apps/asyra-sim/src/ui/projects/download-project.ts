import {
  encodeProject,
  type ProjectSnapshot
} from '../../storage/project-format'

export function downloadRecovery(snapshot: ProjectSnapshot): void {
  downloadText(
    'recovered-sim.json',
    encodeProject(snapshot),
    'application/json'
  )
}

export function downloadText(name: string, text: string, type: string): void {
  downloadBlob(name, new Blob([text], { type }))
}

export function downloadBytes(
  name: string,
  bytes: Uint8Array,
  type: string
): void {
  downloadBlob(name, new Blob([new Uint8Array(bytes)], { type }))
}

function downloadBlob(name: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')

  link.href = url

  link.download = Array.from(name, (character) =>
    character.charCodeAt(0) < 32 ? '_' : character
  )
    .join('')
    .replace(/[\\/:*?"<>|]/g, '_')
    .slice(0, 200)

  document.body.append(link)

  try {
    link.click()
  } finally {
    link.remove()

    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
