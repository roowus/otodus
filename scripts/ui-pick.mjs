// Click-to-inspect: outlines whatever the pointer is over in the running Otodus window and, on
// click, reports the element's selector, box and computed styles. Lets a person point at UI
// instead of describing it. Run with the app already open (`pnpm app`).
import { createRequire } from 'node:module'
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)

// Playwright lives in the pnpm store, not this package's node_modules.
function loadPlaywright() {
  try {
    return require('playwright')
  } catch {
    // fall through to the store copy
  }
  const linksRoot = `${process.env.HOME}/Library/pnpm/store/v11/links/@/playwright`
  if (!existsSync(linksRoot)) {
    throw new Error('playwright is not installed; run `pnpm install` first')
  }
  const { readdirSync } = require('node:fs')
  for (const version of readdirSync(linksRoot)) {
    const hashDir = `${linksRoot}/${version}`
    for (const hash of readdirSync(hashDir)) {
      const candidate = `${hashDir}/${hash}/node_modules/playwright`
      if (existsSync(candidate)) {
        return require(candidate)
      }
    }
  }
  throw new Error('playwright is not installed; run `pnpm install` first')
}

const { chromium } = loadPlaywright()

const PORT = process.env.OTODUS_CDP_PORT ?? '9381'
const OUT = '/tmp/otodus-pick.json'
if (existsSync(OUT)) {
  unlinkSync(OUT)
}

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`)
const pages = browser
  .contexts()[0]
  .pages()
  .filter((p) => !p.url().includes('devtools'))
if (pages.length === 0) {
  throw new Error(`no Otodus window on CDP port ${PORT}; is \`pnpm app\` running?`)
}
const page = pages[0]

await page.evaluate(() => {
  if (window.__otodusPickInstalled) {
    return
  }
  window.__otodusPickInstalled = true
  const style = document.createElement('style')
  style.textContent = `
    #__otodusPickBox{position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #4aa3d8;
      background:rgba(74,163,216,.16);border-radius:3px}
    #__otodusPickTip{position:fixed;pointer-events:none;z-index:2147483647;background:#0d0d0d;
      color:#e6e6e6;font:11px/1.45 -apple-system,BlinkMacSystemFont,sans-serif;padding:4px 7px;
      border-radius:5px;border:1px solid #4aa3d8;white-space:nowrap;max-width:62vw;overflow:hidden;
      text-overflow:ellipsis}
  `
  document.head.append(style)
  const box = document.createElement('div')
  box.id = '__otodusPickBox'
  const tip = document.createElement('div')
  tip.id = '__otodusPickTip'
  document.body.append(box, tip)

  const describe = (el) => {
    if (!el || el === document.body || el === document.documentElement) {
      return 'html'
    }
    const parts = []
    let cur = el
    for (let depth = 0; depth < 5 && cur && cur !== document.body; depth += 1) {
      let segment = cur.tagName.toLowerCase()
      if (cur.id) {
        segment += `#${cur.id}`
      }
      const classes = (cur.getAttribute('class') ?? '').split(/\s+/).filter(Boolean).slice(0, 3)
      if (classes.length > 0) {
        segment += `.${classes.join('.')}`
      }
      for (const attr of ['data-tab-title', 'data-tab-id', 'data-testid', 'role', 'aria-label']) {
        const value = cur.getAttribute(attr)
        if (value) {
          segment += `[${attr}="${value}"]`
        }
      }
      parts.unshift(segment)
      cur = cur.parentElement
    }
    return parts.join(' > ')
  }

  let hovered = null
  const resolveAt = (event) => {
    const el = document.elementFromPoint(event.clientX, event.clientY)
    if (!el || el === box || el === tip) {
      return null
    }
    return liftToMeaningful(el)
  }

  window.addEventListener(
    'mousemove',
    (event) => {
      const el = document.elementFromPoint(event.clientX, event.clientY)
      if (!el || el === box || el === tip) {
        return
      }
      // Lift to the nearest element worth talking about: a click on button text should report the
      // button, not the span holding the characters.
      hovered = liftToMeaningful(el)
      const rect = hovered.getBoundingClientRect()
      box.style.left = `${rect.left}px`
      box.style.top = `${rect.top}px`
      box.style.width = `${rect.width}px`
      box.style.height = `${rect.height}px`
      box.style.display = 'block'
      tip.textContent = describe(hovered)
      tip.style.left = `${Math.min(event.clientX + 12, innerWidth - 340)}px`
      tip.style.top = `${Math.min(event.clientY + 18, innerHeight - 32)}px`
    },
    { capture: true }
  )

  // Why capture both pointerdown and mousedown: xterm binds native listeners on its canvas, and
  // either event may be consumed before a non-capturing handler sees it. Resolving the target
  // here also means a click with no preceding mouse move still reports something.
  const pick = (event) => {
    {
      const target = resolveAt(event) ?? hovered
      hovered = target
      if (!target) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
      const rect = hovered.getBoundingClientRect()
      const computed = getComputedStyle(hovered)
      // The element under the pointer, before lifting, so a report can name what was actually hit.
      const inner = document.elementFromPoint(event.clientX, event.clientY)
      window.__otodusPickResult = {
        selector: describe(hovered),
        css: cssSelector(hovered, inner),
        text: (hovered.textContent ?? '').trim().slice(0, 160),
        hitInside: inner && inner !== hovered ? describe(inner) : null,
        rect: {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        },
        styles: {
          background: computed.backgroundColor,
          color: computed.color,
          padding: computed.padding,
          height: computed.height,
          borderRadius: computed.borderRadius,
          classes: hovered.getAttribute('class')
        }
      }
      box.remove()
      tip.remove()
      window.__otodusPickInstalled = false
    }
  }
  window.addEventListener('pointerdown', pick, { capture: true })
  window.addEventListener('mousedown', pick, { capture: true })

  /** Walk up from `el` to the first element that carries a stable identity or a real box. */
  function liftToMeaningful(el) {
    let cur = el
    for (let depth = 0; depth < 6 && cur && cur !== document.body; depth += 1) {
      const hasMarker =
        cur.id !== '' ||
        cur.hasAttribute('data-testid') ||
        cur.hasAttribute('data-tab-title') ||
        cur.hasAttribute('aria-label') ||
        cur.getAttribute('role') === 'button' ||
        cur.tagName === 'BUTTON' ||
        cur.tagName === 'A' ||
        cur.tagName === 'INPUT'
      if (hasMarker) {
        return cur
      }
      cur = cur.parentElement
    }
    return el
  }

  /** A selector Playwright can run directly, anchored on the nearest stable attribute. */
  function cssSelector(el, inner) {
    const attrOf = (node) => {
      for (const attr of ['data-tab-id', 'data-testid', 'id', 'aria-label']) {
        const value = node.getAttribute(attr)
        if (value) {
          return attr === 'id' ? `#${CSS.escape(value)}` : `[${attr}="${value}"]`
        }
      }
      return null
    }
    const own = attrOf(el)
    if (own) {
      return own
    }
    // Fall back to the hit target anchored inside its nearest named ancestor.
    let anchor = el.parentElement
    while (anchor && anchor !== document.body && !attrOf(anchor)) {
      anchor = anchor.parentElement
    }
    const anchorSel = anchor && anchor !== document.body ? attrOf(anchor) : null
    const innerSel = inner && inner !== el ? el.tagName.toLowerCase() : el.tagName.toLowerCase()
    return anchorSel ? `${anchorSel} ${innerSel}` : innerSel
  }
})

await page.bringToFront().catch(() => {})

// A terminal holding focus swallows the click, so put the pointer somewhere neutral first: the
// window then has a hover target before the person clicks anything.
const start = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
await page.mouse.move(Math.round(start.w * 0.5), Math.round(start.h * 0.5)).catch(() => {})

console.log('Click anything in the Otodus window.')
console.log('Clicking a terminal reports the terminal: click the chrome instead.')
console.log('Ctrl+C here to cancel.')

// Poll rather than await an event: the click lands in the page, and the page cannot signal Node.
for (let attempt = 0; attempt < 2400; attempt += 1) {
  const result = await page.evaluate(() => window.__otodusPickResult ?? null)
  if (result) {
    writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`)
    console.log(`\nPicked: ${result.selector}`)
    console.log(
      `Box: ${result.rect.width}x${result.rect.height} at (${result.rect.x}, ${result.rect.y})`
    )
    console.log(`Saved to ${OUT}`)
    console.log(`\n${readFileSync(OUT, 'utf8')}`)
    break
  }
  await page.waitForTimeout(250)
}

await browser.close()
