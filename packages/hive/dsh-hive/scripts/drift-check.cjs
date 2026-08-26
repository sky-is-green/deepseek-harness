/**
 * Schema-drift gate (X5): regenerate TS types from the sidecar's live
 * /openapi.json and compare against the committed reference.
 *
 * Usage: node scripts/drift-check.cjs [sidecar_base_url]
 * Exit 0 = no drift. Exit 1 = drift detected (or sidecar unreachable).
 *
 * CI: start the sidecar, run this script, fail the pipeline on drift.
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')
const http = require('http')

const base = process.argv[2] || 'http://127.0.0.1:8765'
const pkgDir = path.resolve(__dirname, '..')
const referencePath = path.join(pkgDir, 'sidecar-types.ts')
const specPath = path.join(pkgDir, 'sidecar-openapi.json')
const genScript = path.join(pkgDir, 'scripts', 'generate-sidecar-types.cjs')
const tmpOut = path.join(pkgDir, 'sidecar-types.ts.drift-tmp')

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = ''
      res.on('data', c => { data += c })
      res.on('end', () => {
        try { resolve(JSON.parse(data.replace(/^\uFEFF/, ''))) }
        catch (e) { reject(new Error(`JSON parse failed: ${e.message}`)) }
      })
    }).on('error', reject)
  })
}

async function main() {
  // 1. Fetch live OpenAPI spec
  let spec
  try {
    spec = await fetchJson(`${base}/openapi.json`)
    console.log(`fetched /openapi.json from ${base} (${spec.info?.version || '?'})`)
  } catch (err) {
    console.error(`drift-check: cannot reach sidecar at ${base}: ${err.message}`)
    process.exit(1)
  }

  // 2. Save + regenerate
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2), 'utf8')
  execSync(`node "${genScript}" "${specPath}" "${tmpOut}"`, { stdio: 'pipe' })

  // 3. Compare against the committed reference
  const reference = fs.readFileSync(referencePath, 'utf8')
  const generated = fs.readFileSync(tmpOut, 'utf8')
  fs.unlinkSync(tmpOut) // cleanup

  if (reference === generated) {
    console.log('drift-check: no drift — wire contract is stable')
    process.exit(0)
  }

  // 4. Report the diff
  const refLines = reference.split('\n')
  const genLines = generated.split('\n')
  console.error('drift-check: WIRE CONTRACT DRIFT DETECTED')
  console.error(`  reference: ${referencePath} (${refLines.length} lines)`)
  console.error(`  generated: ${tmpOut} (${genLines.length} lines)`)
  let diffCount = 0
  const maxLine = Math.max(refLines.length, genLines.length)
  for (let i = 0; i < maxLine && diffCount < 20; i++) {
    if (refLines[i] !== genLines[i]) {
      console.error(`  line ${i + 1}:`)
      console.error(`    reference: ${refLines[i] || '(absent)'}`)
      console.error(`    generated: ${genLines[i] || '(absent)'}`)
      diffCount++
    }
  }
  if (diffCount >= 20) console.error('  ... (truncated)')
  console.error('\n  Fix: regenerate sidecar-types.ts and update consumers.')
  process.exit(1)
}

main().catch(err => {
  console.error(`drift-check: ${err.message}`)
  process.exit(1)
})
