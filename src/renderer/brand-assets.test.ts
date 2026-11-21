import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const rendererRoot = import.meta.dirname
const logoSvg = readFileSync(join(rendererRoot, '..', '..', 'resources', 'logo.svg'), 'utf8')
const faviconSvg = readFileSync(join(rendererRoot, 'public', 'favicon.svg'), 'utf8')
const entryPoints = ['index.html', 'web-index.html'].map((name) => ({
  name,
  html: readFileSync(join(rendererRoot, name), 'utf8')
}))

function documentBody(svg: string): string {
  return svg.replace(/<\?xml[^>]*\?>\s*/g, '').trim()
}

function pathData(svg: string): string[] {
  return [...svg.matchAll(/<path d="([^"]+)"/g)].map((match) =>
    match[1].replace(/\s+/g, ' ').trim()
  )
}

describe('brand assets', () => {
  // A <title> sibling before <svg> makes the file invalid standalone XML, so every
  // <img src> of it renders nothing (naturalWidth 0) without any build error.
  it.each([
    ['logo', logoSvg],
    ['favicon', faviconSvg]
  ])('%s svg is a single rooted document', (_name, svg) => {
    const body = documentBody(svg)
    expect(body.startsWith('<svg')).toBe(true)
    expect(body.endsWith('</svg>')).toBe(true)
    expect(body.indexOf('<title')).toBeGreaterThan(body.indexOf('<svg'))
  })

  it('favicon carries the current logo outline', () => {
    expect(pathData(faviconSvg)).toEqual(pathData(logoSvg))
  })

  it('favicon stays transparent with a square canvas', () => {
    expect(faviconSvg).not.toMatch(/<rect\b/)
    const viewBox = /viewBox="([^"]+)"/.exec(faviconSvg)?.[1]?.trim().split(/\s+/).map(Number)
    expect(viewBox).toHaveLength(4)
    expect(viewBox![2]).toBe(viewBox![3])
  })

  it('logo mark is white for the dark landing tile', () => {
    expect(logoSvg).toMatch(/fill="#ffffff"/)
  })

  it.each(entryPoints)('$name links a favicon the bundler serves', ({ html }) => {
    const href = /<link[^>]*rel="icon"[^>]*href="([^"]+)"/.exec(html)?.[1]
    expect(href).toBe('/favicon.svg')
    expect(existsSync(join(rendererRoot, 'public', 'favicon.svg'))).toBe(true)
  })
})
