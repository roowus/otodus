// Click-to-inspect: outlines whatever the pointer is over in the running Otodus window and, on
// click, reports the element's selector, box and computed styles. Lets a person point at UI
// instead of describing it. Run with the app already open (`pnpm app`).
import { createRequire } from 'node:module'
import { existsSync, unlinkSync, writeFileSync } from 'node:fs'

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
      const picked = {
        selector: describe(hovered),
        css: cssSelector(hovered),
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
      // Keep the overlay alive so several elements can be marked in one pass.
      window.__otodusPicks = [...(window.__otodusPicks ?? []), picked]
      // A brief held outline confirms what was taken without ending the session.
      box.style.borderColor = '#7ee787'
      box.style.background = 'rgba(126,231,135,.22)'
      setTimeout(() => {
        box.style.borderColor = '#4aa3d8'
        box.style.background = 'rgba(74,163,216,.16)'
      }, 500)
    }
  }
  window.addEventListener('pointerdown', pick, { capture: true })
  window.addEventListener('mousedown', pick, { capture: true })

  /** A stable identity marker, if the node has one. */
  function markerOf(node) {
    for (const attr of ['data-tab-id', 'data-testid', 'data-tab-title', 'aria-label', 'id']) {
      const value = node.getAttribute?.(attr)
      if (value) {
        return `${attr}="${value}"`
      }
    }
    return null
  }

  /** True for nodes a person would call "the thing": buttons, links, labelled controls. */
  function isInteractive(node) {
    return (
      node.tagName === 'BUTTON' ||
      node.tagName === 'A' ||
      node.tagName === 'INPUT' ||
      node.tagName === 'SELECT' ||
      node.getAttribute('role') === 'button' ||
      node.getAttribute('role') === 'tab' ||
      node.getAttribute('role') === 'menuitem' ||
      node.hasAttribute('data-tab-title')
    )
  }

  /**
   * Walk up from the hit target to the element a person meant.
   *
   * Order of preference: an interactive control, then anything with a stable marker, then the
   * smallest ancestor that actually holds text. A bare layout wrapper with no text and no marker
   * (`div.right-sidebar-activity-strip`) is a bad answer even when it is the first thing hit.
   */
  function liftToMeaningful(el) {
    const ownText = (node) => (node.textContent ?? '').trim()
    let cur = el
    let markerOnly = null
    for (let depth = 0; depth < 8 && cur && cur !== document.body; depth += 1) {
      if (isInteractive(cur)) {
        return cur
      }
      if (!markerOnly && markerOf(cur)) {
        markerOnly = cur
      }
      // The first ancestor that carries text is the smallest thing worth naming.
      if (ownText(cur) && cur.children.length > 0) {
        return markerOnly ?? cur
      }
      cur = cur.parentElement
    }
    return markerOnly ?? el
  }

  /** A selector Playwright can run directly: prefer stable attributes, else a structural path. */
  function cssSelector(el) {
    const attrSel = (node) => {
      for (const attr of ['data-tab-id', 'data-testid', 'data-tab-title', 'aria-label', 'id']) {
        const value = node.getAttribute?.(attr)
        if (value) {
          return attr === 'id' ? `#${CSS.escape(value)}` : `[${attr}="${value}"]`
        }
      }
      return null
    }

    const own = attrSel(el)
    if (own) {
      return own
    }

    // No stable attribute anywhere: build an index path from the nearest anchored ancestor.
    const segments = []
    let cur = el
    for (let depth = 0; depth < 8 && cur && cur !== document.documentElement; depth += 1) {
      const anchored = attrSel(cur)
      if (anchored) {
        segments.unshift(anchored)
        return segments.join(' > ')
      }
      const tag = cur.tagName.toLowerCase()
      const parent = cur.parentElement
      const sameTag = parent
        ? [...parent.children].filter((sibling) => sibling.tagName === cur.tagName)
        : []
      segments.unshift(sameTag.length > 1 ? `${tag}:nth-of-type(${sameTag.indexOf(cur) + 1})` : tag)
      cur = parent
    }
    return segments.join(' > ')
  }
})

await page.bringToFront().catch(() => {})

// A terminal holding focus swallows the click, so put the pointer somewhere neutral first: the
// window then has a hover target before the person clicks anything.
const start = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }))
await page.mouse.move(Math.round(start.w * 0.5), Math.round(start.h * 0.5)).catch(() => {})

console.log('Click any number of elements in the Otodus window.')
console.log('Clicking a terminal reports the terminal: click the chrome instead.')
console.log('Results accumulate; Ctrl+C here to stop and save.')

// Poll rather than await an event: the click lands in the page, and the page cannot signal Node.
// Results accumulate until the person presses Ctrl+C, so several elements can be marked at once.
let written = 0
process.on('SIGINT', async () => {
  console.log(`\nStopped after ${written} pick(s). Saved to ${OUT}`)
  await browser.close().catch(() => {})
  process.exit(0)
})

for (let attempt = 0; attempt < 7200; attempt += 1) {
  const picks = await page.evaluate(() => window.__otodusPicks ?? [])
  if (picks.length > written) {
    written = picks.length
    writeFileSync(OUT, `${JSON.stringify(picks, null, 2)}\n`)
    const latest = picks.at(-1)
    console.log(`\n[${written}] ${latest.css}`)
    console.log(
      `     ${latest.rect.width}x${latest.rect.height} at (${latest.rect.x}, ${latest.rect.y})`
    )
    console.log(`     ${latest.text || latest.selector}`)
  }
  await page.waitForTimeout(250)
}

await browser.close()
