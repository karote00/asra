import { hasExactOwnKeys } from '../domain/records'
import {
  normalizeTrajectorySource,
  type NormalizedTrajectorySource,
  type TrajectoryJointUnit,
  type TrajectoryTimeUnit
} from '../domain/trajectory-source'
import { GEOMETRY_PROFILE, type Workcell } from '../domain/workcell'
import { StorageFormats } from './formats'
import { LEGACY_TRAJECTORY_FORMAT } from './load-migration'

export interface TrajectoryCsvMapping {
  time: { column: string; unit: TrajectoryTimeUnit }
  joints: Readonly<
    Record<string, { column: string; unit: TrajectoryJointUnit }>
  >
}

export interface TrajectoryImportDiagnostic {
  severity: 'error'
  code: string
  message: string
  row?: number
  column?: string
}

export interface TrajectoryImportPreview {
  value: NormalizedTrajectorySource | null
  diagnostics: readonly TrajectoryImportDiagnostic[]
  columns: readonly string[]
  previewRows: readonly Readonly<Record<string, string>>[]
}

interface CsvRow {
  line: number
  cells: string[]
}

export const TRAJECTORY_IMPORT_LIMITS = Object.freeze({
  csvBytes: 8 * 1024 * 1024,
  jsonBytes: 1024 * 1024,
  columns: 256,
  keyframes: GEOMETRY_PROFILE.maxKeyframes
})
const mappingFields = ['time', 'joints'] as const
const mappingEntryFields = ['column', 'unit'] as const
const envelopeFields = ['format', 'version', 'source'] as const
const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

const diagnostic = (
  code: string,
  message: string,
  location: { row?: number; column?: string } = {}
): TrajectoryImportDiagnostic => ({
  severity: 'error',
  code,
  message,
  ...location
})

const emptyPreview = (
  item: TrajectoryImportDiagnostic,
  columns: readonly string[] = []
): TrajectoryImportPreview => ({
  value: null,
  diagnostics: [item],
  columns,
  previewRows: []
})

const byteLength = (text: string): number =>
  new TextEncoder().encode(text).length

class CsvResourceError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
  }
}

function parseCsv(text: string): CsvRow[] {
  const rows: CsvRow[] = []
  let cells: string[] = [],
    field = '',
    line = 1,
    rowLine = 1,
    quoted = false,
    closedQuote = false
  const checkCapacity = () => {
    if (rows.length >= TRAJECTORY_IMPORT_LIMITS.keyframes + 1)
      throw new CsvResourceError(
        'too-many-rows',
        `CSV exceeds ${TRAJECTORY_IMPORT_LIMITS.keyframes} trajectory rows.`
      )
    if (cells.length >= TRAJECTORY_IMPORT_LIMITS.columns)
      throw new CsvResourceError(
        'too-many-columns',
        `CSV exceeds ${TRAJECTORY_IMPORT_LIMITS.columns} columns.`
      )
  }
  const finishField = () => {
    checkCapacity()
    cells.push(field.trim())
    field = ''
    closedQuote = false
  }
  const finishRow = () => {
    finishField()
    rows.push({ line: rowLine, cells })
    cells = []
    rowLine = line + 1
  }
  for (let index = 0; index < text.length; index++) {
    checkCapacity()
    const character = text[index]
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"'
          index++
        } else {
          quoted = false
          closedQuote = true
        }
      } else {
        field += character
        if (character === '\n') line++
      }
      continue
    }
    if (character === '"') {
      if (field.length || closedQuote)
        throw new Error(`Unexpected quote on CSV line ${line}`)
      quoted = true
    } else if (character === ',') finishField()
    else if (character === '\n') {
      finishRow()
      line++
    } else if (character === '\r') {
      if (text[index + 1] !== '\n') {
        finishRow()
        line++
      }
    } else {
      if (closedQuote && !/\s/.test(character))
        throw new Error(`Unexpected content after quote on CSV line ${line}`)
      field += character
    }
  }
  if (quoted) throw new Error(`Unclosed quote on CSV line ${line}`)
  if (field.length || cells.length || !rows.length) finishRow()
  return rows
}

function validateMapping(
  mapping: unknown,
  workcell: Workcell,
  columns: readonly string[]
): string | null {
  if (!hasExactOwnKeys(mapping, mappingFields)) return 'Invalid mapping shape'
  if (!hasExactOwnKeys(mapping.time, mappingEntryFields))
    return 'Invalid time mapping'
  if (
    typeof mapping.time.column !== 'string' ||
    (mapping.time.unit !== 'ms' && mapping.time.unit !== 's')
  )
    return 'An explicit supported time unit is required'
  const actuated = workcell.bodies.filter((body) => body.joint.kind !== 'fixed')
  if (
    !hasExactOwnKeys(
      mapping.joints,
      actuated.map((body) => body.id)
    )
  )
    return 'Every actuated joint requires one mapping'
  const mappedColumns = [mapping.time.column]
  for (const body of actuated) {
    const entry = mapping.joints[body.id]
    if (!hasExactOwnKeys(entry, mappingEntryFields))
      return `Invalid mapping for joint ${body.id}`
    if (typeof entry.column !== 'string')
      return `Invalid column for joint ${body.id}`
    if (
      (body.joint.kind === 'revolute' &&
        entry.unit !== 'deg' &&
        entry.unit !== 'rad') ||
      (body.joint.kind === 'prismatic' &&
        entry.unit !== 'mm' &&
        entry.unit !== 'm')
    )
      return `An explicit compatible unit is required for joint ${body.id}`
    mappedColumns.push(entry.column)
  }
  if (new Set(mappedColumns).size !== mappedColumns.length)
    return 'A CSV column cannot be mapped more than once'
  const missing = mappedColumns.find((column) => !columns.includes(column))
  return missing ? `Mapped column ${missing} is missing` : null
}

function parseDecimal(value: string): number | null {
  if (!decimal.test(value)) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function previewTrajectoryCsv(
  text: string,
  workcell: Workcell,
  mapping: TrajectoryCsvMapping
): TrajectoryImportPreview {
  if (byteLength(text) > TRAJECTORY_IMPORT_LIMITS.csvBytes)
    return emptyPreview(
      diagnostic('file-too-large', 'Trajectory CSV exceeds the 8 MiB limit.')
    )
  let rows: CsvRow[]
  try {
    rows = parseCsv(text.replace(/^\uFEFF/, ''))
  } catch (error) {
    return emptyPreview(
      diagnostic(
        error instanceof CsvResourceError ? error.code : 'csv-syntax',
        error instanceof Error ? error.message : 'Invalid CSV syntax'
      )
    )
  }
  const headerRow = rows.shift(),
    columns = headerRow?.cells ?? []
  if (!headerRow || !columns.length || columns.some((column) => !column))
    return emptyPreview(
      diagnostic('missing-header', 'CSV requires a header row.')
    )
  if (new Set(columns).size !== columns.length)
    return emptyPreview(
      diagnostic('duplicate-header', 'CSV column names must be unique.'),
      columns
    )
  if (!rows.length)
    return emptyPreview(
      diagnostic('empty-trajectory', 'CSV requires at least one data row.'),
      columns
    )
  const mappingError = validateMapping(mapping, workcell, columns)
  if (mappingError)
    return emptyPreview(diagnostic('invalid-mapping', mappingError), columns)

  const columnIndex = new Map(columns.map((column, index) => [column, index])),
    diagnostics: TrajectoryImportDiagnostic[] = [],
    sourceFrames: { time: number; joints: Record<string, number> }[] = [],
    previewRows: Readonly<Record<string, string>>[] = [],
    jointUnits: Record<string, TrajectoryJointUnit> = {},
    jointMappings = Object.entries(mapping.joints)
  for (const [id, entry] of jointMappings) jointUnits[id] = entry.unit
  let previous = -Infinity
  for (const row of rows) {
    const display = Object.fromEntries(
      columns.map((column, index) => [column, row.cells[index] ?? ''])
    )
    if (previewRows.length < 20) previewRows.push(display)
    if (row.cells.length !== columns.length) {
      diagnostics.push(
        diagnostic(
          'column-count',
          `Expected ${columns.length} columns but found ${row.cells.length}.`,
          { row: row.line }
        )
      )
      continue
    }
    const timeCell =
        row.cells[columnIndex.get(mapping.time.column) ?? -1] ?? '',
      time = parseDecimal(timeCell),
      joints: Record<string, number> = {}
    let rowInvalid = false
    if (time === null) {
      diagnostics.push(
        diagnostic('invalid-number', 'Time must be a finite decimal number.', {
          row: row.line,
          column: mapping.time.column
        })
      )
      rowInvalid = true
    }
    for (const [id, entry] of jointMappings) {
      const cell = row.cells[columnIndex.get(entry.column) ?? -1] ?? '',
        value = parseDecimal(cell)
      if (value === null) {
        diagnostics.push(
          diagnostic(
            'invalid-number',
            `Joint ${id} must be a finite decimal number.`,
            { row: row.line, column: entry.column }
          )
        )
        rowInvalid = true
      } else joints[id] = value
    }
    if (rowInvalid || time === null) continue
    const frame = { time, joints }
    try {
      const normalized = normalizeTrajectorySource(workcell, {
        version: 1,
        timeUnit: mapping.time.unit,
        jointUnits,
        keyframes: [frame]
      }).trajectory.keyframes[0]
      if (!normalized) throw new Error('Missing normalized row')
      if (normalized.time - previous < 0.000001) {
        diagnostics.push(
          diagnostic(
            'time-order',
            'Times must be strictly increasing after unit conversion.',
            { row: row.line, column: mapping.time.column }
          )
        )
        continue
      }
      previous = normalized.time
      sourceFrames.push(frame)
    } catch (error) {
      diagnostics.push(
        diagnostic(
          'invalid-row',
          error instanceof Error ? error.message : 'Invalid trajectory row',
          { row: row.line }
        )
      )
    }
  }
  if (diagnostics.length)
    return { value: null, diagnostics, columns, previewRows }
  try {
    return {
      value: normalizeTrajectorySource(workcell, {
        version: 1,
        timeUnit: mapping.time.unit,
        jointUnits,
        keyframes: sourceFrames
      }),
      diagnostics: [],
      columns,
      previewRows
    }
  } catch (error) {
    return {
      value: null,
      diagnostics: [
        diagnostic(
          'invalid-trajectory',
          error instanceof Error ? error.message : 'Invalid trajectory'
        )
      ],
      columns,
      previewRows
    }
  }
}

export function previewTrajectoryJson(
  text: string,
  workcell: Workcell
): TrajectoryImportPreview {
  if (byteLength(text) > TRAJECTORY_IMPORT_LIMITS.jsonBytes)
    return emptyPreview(
      diagnostic('file-too-large', 'Trajectory JSON exceeds the 1 MiB limit.')
    )
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return emptyPreview(
      diagnostic('json-syntax', 'Trajectory JSON is malformed.')
    )
  }
  if (
    !hasExactOwnKeys(data, envelopeFields) ||
    (data.format !== StorageFormats.TRAJECTORY &&
      data.format !== LEGACY_TRAJECTORY_FORMAT) ||
    data.version !== 1
  )
    return emptyPreview(
      diagnostic(
        'unsupported-format',
        'Trajectory JSON requires the exact supported format and version.'
      )
    )
  try {
    return {
      value: normalizeTrajectorySource(workcell, data.source),
      diagnostics: [],
      columns: [],
      previewRows: []
    }
  } catch (error) {
    return emptyPreview(
      diagnostic(
        'invalid-trajectory',
        error instanceof Error ? error.message : 'Invalid trajectory data'
      )
    )
  }
}
