export type DropIndicator = 'left' | 'right' | null

// Use a visible blue insertion cue above tab borders without changing layout.
export function getDropIndicatorClasses(dropIndicator: DropIndicator): string {
  if (dropIndicator === 'left') {
    return "before:absolute before:inset-y-0 before:left-0 before:w-[2px] before:bg-blue-500 before:z-10 before:content-['']"
  }
  if (dropIndicator === 'right') {
    return "after:absolute after:inset-y-0 after:right-0 after:w-[2px] after:bg-blue-500 after:z-10 after:content-['']"
  }
  return ''
}

// A floating pill carries its accent as a full rounded ring, since it has no bottom edge on the
// window to underline. Inset keeps the ring inside the tab's own rounded corners.
export const ACTIVE_TAB_INDICATOR_CLASSES =
  'pointer-events-none absolute inset-0 rounded-[10px] ring-1 ring-inset ring-tab-active-indicator/70 z-20 group-data-[single-tab]/tab-strip:hidden'

// Floating tab pills: every corner rounds and the margin is the gap to the strip on all four
// sides, so no tab edge ever touches the window chrome.
export const TAB_IS_FLOATING = true
export const TAB_ROUNDED_CLASSES = 'rounded-[10px] mx-0.5 overflow-hidden'

export function getTabRootStateClasses(isActive: boolean): string {
  return [
    isActive
      ? 'bg-tab-active text-tab-active-foreground'
      : 'bg-tab-inactive text-tab-inactive-foreground hover:text-tab-active-foreground',
    TAB_ROUNDED_CLASSES
  ].join(' ')
}

/** A floating pill draws its own outline, so the strip-level seam edges are only for joined tabs. */
export function getTabStripBorderClasses(
  hasTabsToRight: boolean,
  options?: { includeTopBorder?: boolean }
): string {
  const includeTopBorder = options?.includeTopBorder ?? true
  if (TAB_IS_FLOATING) {
    return ''
  }
  return [
    includeTopBorder ? 'border-t' : '',
    'border-r border-border',
    hasTabsToRight ? '' : 'border-r-transparent'
  ]
    .filter(Boolean)
    .join(' ')
}
