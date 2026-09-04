import { encodeProject, type ProjectSnapshot } from '../storage/project-format'

export function downloadRecovery(snapshot: ProjectSnapshot): void {
  downloadText(
    'recovered-asyra-sim.json',
    encodeProject(snapshot),
    'application/json'
  )
}

export function downloadText(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type })
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
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
