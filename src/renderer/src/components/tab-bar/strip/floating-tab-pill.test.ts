import { describe, expect, it } from 'vitest'
import {
  ACTIVE_TAB_INDICATOR_CLASSES,
  TAB_ROUNDED_CLASSES,
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

describe('floating tab pill', () => {
  it('rounds all four corners, so no edge is left square against the window', () => {
    expect(cornerClasses(TAB_ROUNDED_CLASSES)).toEqual(['10', '10', '10', '10'])
  })

  it('insets the pill horizontally as well as vertically', () => {
    // Without a horizontal inset the first and last pills sit flush on the strip's edges.
    expect(TAB_ROUNDED_CLASSES).toMatch(/\bmx-/)
    expect(TAB_ROUNDED_CLASSES).not.toMatch(/\bmy-/)
  })

  it('keeps the pill inside the strip: its own margin supplies the gap, not overflow', () => {
    // A `my-*` next to `h-full` makes the tab taller than the strip, which is what pushed the
    // original tab's bottom edge onto the window.
    for (const classes of [getTabRootStateClasses(true), getTabRootStateClasses(false)]) {
      expect(classes).not.toMatch(/\bh-full\b/)
      expect(classes).not.toMatch(/\bmy-/)
    }
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
