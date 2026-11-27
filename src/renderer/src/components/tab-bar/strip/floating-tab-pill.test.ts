import { describe, expect, it } from 'vitest'
import {
  ACTIVE_TAB_INDICATOR_CLASSES,
  TAB_ROUNDED_CLASSES,
  TAB_STRIP_ROW_CLASSES,
  getTabRootStateClasses,
  getTabStripBorderClasses
} from './drop-indicator'

/** The rounded corners a class string applies, as `[top, right, bottom, left]`. */
function cornerClasses(classes: string): string[] {
  const all = /rounded-\[(\d+)px\]/.exec(classes)?.[1]
  if (all) {
    return [all, all, all, all]
  }
  const directional = /rounded-t-\[(\d+)px\]/.exec(classes)?.[1]
  return directional ? [directional, '0', '0', '0'] : []
}

/** Pixels for a Tailwind spacing token: a bare step is 4px, a `[Npx]` value is N. */
function pxOf(token: string | undefined): number | null {
  if (token === undefined) {
    return null
  }
  const arbitrary = /^\d+px$/.exec(token)
  return arbitrary ? Number(arbitrary[0].replace('px', '')) : Number(token) * 4
}

/** Resolves one side's padding from most- to least-specific utility. */
function sidePadding(classes: string, sides: readonly string[]): number | null {
  for (const side of sides) {
    const match =
      new RegExp(`\\b${side}-\\[(\\d+px)\\]`).exec(classes) ??
      new RegExp(`\\b${side}-(\\d+)\\b`).exec(classes)
    if (match) {
      return pxOf(match[1])
    }
  }
  return null
}

const paddingTop = (c: string): number | null => sidePadding(c, ['pt', 'py', 'p'])
const paddingBottom = (c: string): number | null => sidePadding(c, ['pb', 'py', 'p'])
const paddingLeft = (c: string): number | null => sidePadding(c, ['pl', 'px', 'p'])
const paddingRight = (c: string): number | null => sidePadding(c, ['pr', 'px', 'p'])

describe('floating tab pill', () => {
  it('rounds all four corners, so no edge is left square against the window', () => {
    expect(cornerClasses(TAB_ROUNDED_CLASSES)).toEqual(['10', '10', '10', '10'])
  })

  it('takes its inset from the strip, never from its own margin', () => {
    // A margin next to a percentage height is circular: the height resolves against a wrapper
    // whose height comes from the tab. That collapsed the pill to 8px tall.
    for (const classes of [getTabRootStateClasses(true), getTabRootStateClasses(false)]) {
      expect(classes).not.toMatch(/\bm[xy]-/)
      expect(classes).not.toMatch(/calc\(/)
    }
  })

  it('fills the row, so the row padding decides the gap on every side', () => {
    expect(TAB_ROUNDED_CLASSES).not.toMatch(/\bh-/)
  })

  it('draws no strip seam on a pill that floats free of its neighbours', () => {
    expect(getTabStripBorderClasses(true)).toBe('')
    expect(getTabStripBorderClasses(false)).toBe('')
  })

  it('marks the active tab with a ring that follows its corners instead of a bottom rule', () => {
    expect(ACTIVE_TAB_INDICATOR_CLASSES).toMatch(/\bring-1\b/)
    expect(ACTIVE_TAB_INDICATOR_CLASSES).toMatch(/\brounded-\[10px\]/)
    expect(ACTIVE_TAB_INDICATOR_CLASSES).not.toMatch(/\bbottom-0\b/)
  })

  it('still distinguishes the active tab by its own surface colors', () => {
    expect(getTabRootStateClasses(true)).toContain('bg-tab-active')
    expect(getTabRootStateClasses(false)).toContain('bg-tab-inactive')
  })
})

describe('tab row inset', () => {
  it('gives the pill the same clear background above as below the rule', () => {
    // The rule paints on the row's last pixel, so the bottom padding is one larger and the two
    // clear bands come out equal. Measured in the running app at 6px above and 6px below.
    expect(paddingTop(TAB_STRIP_ROW_CLASSES)).toBe(6)
    expect(paddingBottom(TAB_STRIP_ROW_CLASSES)).toBe(7)
  })

  it('keeps the horizontally inset sides equal to each other', () => {
    expect(paddingLeft(TAB_STRIP_ROW_CLASSES)).toBe(paddingRight(TAB_STRIP_ROW_CLASSES))
    expect(paddingLeft(TAB_STRIP_ROW_CLASSES)).toBe(8)
  })

  it('paints the rule with an inset shadow, since a border is subtracted from the content box', () => {
    expect(TAB_STRIP_ROW_CLASSES).toMatch(/shadow-\[inset_0_-1px_0_var\(--border\)\]/)
    expect(TAB_STRIP_ROW_CLASSES).not.toMatch(/\bborder-b\b/)
  })
})
