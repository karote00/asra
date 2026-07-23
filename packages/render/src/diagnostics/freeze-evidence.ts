export const freezeEvidence = <T>(value: T): T => {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) {
    return value
  }

  Object.freeze(value)
  Object.values(value).forEach(freezeEvidence)
  return value
}
