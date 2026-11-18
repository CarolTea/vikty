// Fails if browser storage is used outside the single allowed file.
// Browser storage is for UI preferences only; business data comes from the API.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'src')
const allowed = 'src/lib/preferences.ts'
const pattern = /\b(localStorage|sessionStorage)\b/

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) yield* walk(p)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(name)) yield p
  }
}

const hits = []
for (const file of walk(src)) {
  const rel = relative(root, file).replaceAll(sep, '/')
  if (rel === allowed) continue
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, i) => {
    if (pattern.test(line)) hits.push(`${rel}:${i + 1}: ${line.trim()}`)
  })
}

if (hits.length) {
  console.error(`Browser storage is only allowed in ${allowed} (UI preferences):\n${hits.join('\n')}`)
  process.exit(1)
}
console.log('check-storage: ok')
