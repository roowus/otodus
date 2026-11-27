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

// Floating tab pills: every corner rounds. The inset comes from the strip's own padding and gap,
// never from a margin here — a percentage height plus a margin on the same box is circular and
// resolves to a collapsed pill.
export const TAB_IS_FLOATING = true
export const TAB_ROUNDED_CLASSES = 'rounded-[10px] overflow-hidden'

export function getTabRootStateClasses(isActive: boolean): string {
  return [
    isActive
      ? 'bg-tab-active text-tab-active-foreground'
      : // The hover fill has to be a background, not just text: on a floating pill the text
        // alone barely reads, since the pill already sits on the strip's own surface.
        'bg-tab-inactive text-tab-inactive-foreground hover:bg-tab-hover hover:text-tab-active-foreground',
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

/** The row that holds a floating strip. Its height plus the 4px drag strip above it must equal
 *  the 36px header the sidebars use, or the three top bars end on different lines: the row gets
 *  32px, of which the bottom pixel is the rule and the rest is the pill and its breathing room. */
export const TAB_STRIP_ROW_CLASSES =
  'relative flex h-8 shrink-0 items-center bg-tab-bar px-2 shadow-[inset_0_-1px_0_var(--border)]'
