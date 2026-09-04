import { encodeProject, type ProjectSnapshot } from '../storage/project-format'

export function downloadRecovery(snapshot: ProjectSnapshot): void {
  const blob = new Blob([encodeProject(snapshot)], { type: 'application/json' })
  const url = URL.createObjectURL(blob),
    link = document.createElement('a')
  link.href = url
  link.download = 'recovered-asyra-sim.json'
  document.body.append(link)
  try {
    link.click()
  } finally {
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}
