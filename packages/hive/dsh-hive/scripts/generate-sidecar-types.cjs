/**
 * Generates TypeScript types from the sidecar's OpenAPI spec.
 *
 * Usage: node scripts/generate-sidecar-types.js <openapi.json> <output.ts>
 *
 * The generated file is committed to the repo. The drift-check script
 * re-generates it and fails if the committed copy differs — any sidecar
 * wire-contract change is caught at CI time instead of at runtime.
 */

const fs = require('fs')
const path = require('path')

const specPath = process.argv[2]
const outPath = process.argv[3]
if (!specPath || !outPath) {
  console.error('usage: node generate-sidecar-types.js <openapi.json> <output.ts>')
  process.exit(1)
}

const raw = fs.readFileSync(specPath, 'utf8')
const spec = JSON.parse(raw.replace(/^\uFEFF/, '')) // strip BOM from PowerShell-written files

// ---------------------------------------------------------------------------
// OpenAPI schema → TypeScript type string
// ---------------------------------------------------------------------------
function schemaToTs(schema, indent = '') {
  if (!schema || Object.keys(schema).length === 0) return 'Record<string, unknown>'
  if (schema.type === 'string') {
    if (schema.enum) return schema.enum.map(v => `'${v}'`).join(' | ')
    return 'string'
  }
  if (schema.type === 'integer' || schema.type === 'number') return 'number'
  if (schema.type === 'boolean') return 'boolean'
  if (schema.type === 'array') return `Array<${schemaToTs(schema.items, indent)}>`
  if (schema.type === 'object') {
    if (!schema.properties) return 'Record<string, unknown>'
    const lines = []
    const required = new Set(schema.required || [])
    for (const [key, prop] of Object.entries(schema.properties)) {
      const opt = required.has(key) ? '' : '?'
      const desc = prop.description ? `  /** ${prop.description} */\n` : ''
      lines.push(`${desc}${indent}  ${key}${opt}: ${schemaToTs(prop, indent + '  ')}`)
    }
    return `{\n${lines.join('\n')}\n${indent}}`
  }
  if (schema.$ref) {
    const name = schema.$ref.split('/').pop()
    return tsTypeName(name)
  }
  if (schema.anyOf) return schema.anyOf.map(s => schemaToTs(s, indent)).join(' | ')
  return 'unknown'
}

function tsTypeName(openapiName) {
  // "TurnRequest" → "TurnRequest" (already PascalCase in our FastAPI models)
  return openapiName.replace(/[^A-Za-z0-9]/g, '')
}

// ---------------------------------------------------------------------------
// Generate operation types (request bodies + response shapes)
// ---------------------------------------------------------------------------
const lines = []
lines.push('/* AUTO-GENERATED from the sidecar\'s /openapi.json — do not edit by hand.')
lines.push(' * Regenerate: node scripts/generate-sidecar-types.js <openapi.json> <this file>')
lines.push(' * Drift check: node scripts/drift-check.js (fails CI on wire-contract change)')
lines.push(' */')
lines.push('')
lines.push(`export const SIDECAR_TITLE = '${spec.info.title}'`)
lines.push(`export const SIDECAR_VERSION = '${spec.info.version}'`)
lines.push('')

// Schemas section
if (spec.components?.schemas) {
  lines.push('// ------------------------------------------------------------------')
  lines.push('// Schemas')
  lines.push('// ------------------------------------------------------------------')
  for (const [name, schema] of Object.entries(spec.components.schemas)) {
    const tsName = tsTypeName(name)
    lines.push(`export type ${tsName} = ${schemaToTs(schema)}`)
    lines.push('')
  }
}

// Paths section — grouped by tag or path prefix
lines.push('// ------------------------------------------------------------------')
lines.push('// Endpoints')
lines.push('// ------------------------------------------------------------------')
for (const [path, methods] of Object.entries(spec.paths)) {
  for (const [method, op] of Object.entries(methods)) {
    if (typeof op !== 'object' || !op.responses) continue
    const opId = op.operationId || `${method}_${path}`
    const tsOpName = tsTypeName(opId)
    const successCode = Object.keys(op.responses).find(code => code.startsWith('2'))
    if (!successCode) continue
    const respSchema = op.responses[successCode]?.content?.['application/json']?.schema
    if (!respSchema) continue // skip endpoints with no JSON response body
    const reqBody = op.requestBody?.content?.['application/json']?.schema

    // Request body type
    if (reqBody) {
      const reqName = `${tsOpName}Request`
      lines.push(`export type ${reqName} = ${schemaToTs(reqBody)}`)
      lines.push('')
    }

    // Response type (skip if no JSON response body)
    if (respSchema) {
      const respName = `${tsOpName}Response`
      lines.push(`export type ${respName} = ${schemaToTs(respSchema)}`)
      lines.push('')
    }
  }
}

fs.writeFileSync(outPath, lines.join('\n') + '\n', 'utf8')
console.log(`generated ${lines.length} lines -> ${outPath}`)
