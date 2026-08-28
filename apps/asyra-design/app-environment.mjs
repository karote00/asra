import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'
import { fileURLToPath, URL } from 'node:url'

const appDir = fileURLToPath(new URL('.', import.meta.url))
const defaultEnvironmentPath = resolve(appDir, '.env')
const defaultAppURL = 'http://localhost:3000'

const isNonEmptyString = (value) =>
  typeof value === 'string' && value.trim().length > 0

const resolvePort = (value, name) => {
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${name} must be a valid port`)
  }
  return port
}

const normalizeEnvValue = (value) => {
  const trimmed = value.trim()
  if (
    trimmed.length >= 2 &&
    ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'")))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export const loadEnvironment = (
  environment = process.env,
  environmentPath = defaultEnvironmentPath
) => {
  if (!existsSync(environmentPath)) return environment

  for (const rawLine of readFileSync(environmentPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue
    environment[key] ??= normalizeEnvValue(line.slice(separatorIndex + 1))
  }

  return environment
}

export const resolveEnvironment = (environment = process.env) => {
  const configuredAppURL = environment.APP_URL?.trim()
  const appURLValue = isNonEmptyString(configuredAppURL)
    ? configuredAppURL
    : defaultAppURL

  let appURL
  try {
    appURL = new URL(appURLValue)
  } catch {
    throw new Error('APP_URL must be a valid URL')
  }

  if (appURL.protocol !== 'http:' && appURL.protocol !== 'https:') {
    throw new Error('APP_URL must use http or https')
  }
  if (
    appURL.username ||
    appURL.password ||
    appURL.pathname !== '/' ||
    appURL.search ||
    appURL.hash
  ) {
    throw new Error(
      'APP_URL must be an origin without credentials, path, query, or hash'
    )
  }

  const collaborationWebSocketHost =
    environment.COLLABORATION_WS_HOST?.trim() || '127.0.0.1'
  const collaborationWebSocketPort = resolvePort(
    environment.COLLABORATION_WS_PORT ?? '4101',
    'COLLABORATION_WS_PORT'
  )
  const healthHost = collaborationWebSocketHost.includes(':')
    ? `[${collaborationWebSocketHost}]`
    : collaborationWebSocketHost

  return Object.freeze({
    appURL: appURL.origin,
    viteHost: appURL.hostname,
    vitePort: resolvePort(
      appURL.port || (appURL.protocol === 'https:' ? '443' : '80'),
      'APP_URL port'
    ),
    collaborationWebSocketHost,
    collaborationWebSocketPort,
    collaborationHealthURL: `http://${healthHost}:${collaborationWebSocketPort}/health`
  })
}
