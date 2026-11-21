import { globSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Client-voice phrases that must say Otodus; each one shipped as "Orca" once and a
// weekly upstream merge can reintroduce any of them silently. Wire identifiers
// (x-orca-* headers, the orca bin, Orca Cloud/account/Relay/server) are out of scope,
// so the possessive forms ("Orca’s server") are deliberately allowed to match.
const clientVoiceRegressions: RegExp[] = [
  /Restart Orca(?![’'])/g,
  /Orca wakes you/g,
  /Other Orca window/g,
  /Other Orca instance/g,
  /another Orca that’s open/g,
  // Packaged binary paths: the app executable is Otodus, and a stale Orca name
  // here breaks the packaged CLI launcher at runtime.
  /MacOS\/Orca\b/g,
  /Orca\.app\b/g,
  /Orca\.exe\b/g,
  /executableName: 'Orca'/g
]

const repoRoot = join(import.meta.dirname, '..', '..')
const files = [
  ...globSync(join(repoRoot, 'src', '**', '*.{ts,tsx,json}')),
  ...globSync(join(repoRoot, 'config', 'scripts', '**', '*.{ts,mjs}')),
  ...globSync(join(repoRoot, 'skill-guides', '**', '*.md')),
  ...globSync(join(repoRoot, 'docs', 'site', 'content', '**', '*.mdx'))
].filter(
  (file) =>
    !file.endsWith('brand-voice.test.ts') &&
    // Verbatim capture of an upstream stablyai/orca GitHub issue title; renaming falsifies it.
    !file.endsWith('work-item-search-metadata.json')
)

describe('brand voice', () => {
  it('keeps shipped surfaces free of client-voice Orca regressions', () => {
    expect(files.length).toBeGreaterThan(1000)
    const offenders: string[] = []
    for (const file of files) {
      const text = readFileSync(file, 'utf8')
      for (const phrase of clientVoiceRegressions) {
        phrase.lastIndex = 0
        if (phrase.test(text)) {
          offenders.push(`${file.replace(`${repoRoot}/`, '')}: ${phrase}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
