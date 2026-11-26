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

/** The uniform inset a row class string applies on every side, or null when they disagree. */
function evenRowInset(classes: string): string | null {
  return new RegExp('\\bp-(\\d+)\\b').exec(classes)?.[1] ?? null
}

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
  it('pads every side by the same amount, so the pill is evenly inset', () => {
    // One uniform `p-*`: mixed px/pt/pb values are how the top and bottom drifted apart.
    expect(evenRowInset(TAB_STRIP_ROW_CLASSES)).toBe('2')
    expect(TAB_STRIP_ROW_CLASSES).not.toMatch(/\bp[trblxy]-/)
  })

  it('draws its rule with a shadow, since a border would steal a pixel from the bottom inset', () => {
    expect(TAB_STRIP_ROW_CLASSES).toMatch(/shadow-\[inset_0_-1px_0_var\(--border\)\]/)
    expect(TAB_STRIP_ROW_CLASSES).not.toMatch(/\bborder-b\b/)
  })
})
