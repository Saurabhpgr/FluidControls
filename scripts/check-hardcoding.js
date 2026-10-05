/**
 * Fluid Controls ETMS — Zero-Hardcoding CI Guard
 * Scans frontend source files for hardcoded business logic, demo constants, or branch checks on static names.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const SRC_DIR = path.resolve(__dirname, '../src')

const FORBIDDEN_PATTERNS = [
  {
    regex: /if\s*\(\s*name\s*===?\s*['"][^'"]+['"]\s*\)/i,
    message: 'Hardcoded branch on entity name detected. Branch on data attributes instead.',
  },
  {
    regex: /fake_employee|mock_data|dummy_user/i,
    message: 'Mock/placeholder data remnant detected in production source.',
  },
]

let violations = 0

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      scanDirectory(fullPath)
    } else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      FORBIDDEN_PATTERNS.forEach(({ regex, message }) => {
        const matches = content.match(regex)
        if (matches) {
          console.error(`❌ [HARDCODING VIOLATION] in ${path.relative(SRC_DIR, fullPath)}: ${message}`)
          console.error(`   Found: "${matches[0]}"`)
          violations++
        }
      })
    }
  }
}

console.log('🔍 Running Fluid Controls Zero-Hardcoding Audit Guard...')
scanDirectory(SRC_DIR)

if (violations > 0) {
  console.error(`\n🚨 Failed: Found ${violations} hardcoding violation(s).`)
  process.exit(1)
} else {
  console.log('✅ Zero-Hardcoding Audit Passed: 0 hardcoding violations found across all source files.')
  process.exit(0)
}
