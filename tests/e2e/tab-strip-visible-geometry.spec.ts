import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

/**
 * The tab strip must actually be laid out, not merely present in the DOM.
 *
 * A wrapper in TabGroupPanel lost its `flex-1` once: the strip inside is `flex-1` with no
 * intrinsic width, so that wrapper measured 0px, the strip's `overflow-x-auto` clipped to its
 * 40px floor, and every tab vanished. Nothing failed, because no test measured a box.
 * happy-dom reports every box as 0px, so this has to run against a real window.
 */

type StripGeometry = {
  stripWidth: number
  stripHeight: number
  tabCount: number
  laidOutTabs: number
  tabWidths: number[]
  /** Widths of each box between the strip and its group row, outermost last. */
  chainWidths: number[]
}

function readStripGeometry(selector: string): StripGeometry {
  const strip = document.querySelector<HTMLElement>(selector)
  if (!strip) {
    throw new Error(`tab strip ${selector} is not in the DOM`)
  }
  const stripRect = strip.getBoundingClientRect()
  const tabs = [...strip.querySelectorAll<HTMLElement>('[data-tab-id]')]
  const tabWidths = tabs.map((tab) => tab.getBoundingClientRect().width)

  const chainWidths: number[] = []
  let node: Element | null = strip
  for (let depth = 0; depth < 8 && node; depth += 1) {
    chainWidths.push(Math.round(node.getBoundingClientRect().width))
    if (node.hasAttribute('data-tab-group-strip-id')) {
      break
    }
    node = node.parentElement
  }

  return {
    stripWidth: Math.round(stripRect.width),
    stripHeight: Math.round(stripRect.height),
    tabCount: tabs.length,
    laidOutTabs: tabWidths.filter((width) => width > 0).length,
    tabWidths: tabWidths.map((width) => Math.round(width)),
    chainWidths
  }
}

/** The active group, holding at least `count` tabs, with its strip mounted and visible. */
async function ensureTabs(page: Page, worktreeId: string, count: number): Promise<string> {
  const groupId = await page.evaluate(
    (id) => window.__store?.getState().activeGroupIdByWorktree[id] ?? '',
    worktreeId
  )
  expect(groupId).not.toBe('')

  // A group renders no strip until it holds a tab, so adding tabs is what mounts the row.
  await page.evaluate(
    ({ id, group, want }) => {
      const state = window.__store?.getState()
      const existing =
        state?.unifiedTabsByWorktree[id]?.filter((tab) => tab.groupId === group) ?? []
      for (let index = existing.length; index < want; index += 1) {
        state?.createTab(id, group, undefined, { activate: index === 0 })
      }
    },
    { id: worktreeId, group: groupId, want: count }
  )
  await expect(page.locator(`[data-tab-group-strip-id="${groupId}"]`)).toBeVisible()
  return groupId
}

test('every tab is laid out with a real width inside its strip', async ({ orcaPage }) => {
  await orcaPage.setViewportSize({ width: 1280, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)

  // Six tabs, so the strip has real content and an overflow floor to sit above.
  const groupId = await ensureTabs(orcaPage, worktreeId, 6)
  const selector = `[data-tab-group-strip-id="${groupId}"] [data-tab-strip-scroller]`

  await expect(orcaPage.locator(`${selector} [data-tab-id]`)).toHaveCount(6)
  await expect
    .poll(async () => orcaPage.evaluate(readStripGeometry, selector))
    .toMatchObject({ tabCount: 6, laidOutTabs: 6 })
  const geometry = await orcaPage.evaluate(readStripGeometry, selector)

  // The regression produced a 40px strip with no visible tabs. A strip holding six tabs across a
  // 1280px window has to be wide in absolute terms; the exact number is not the contract.
  expect(geometry.stripWidth).toBeGreaterThan(400)
  expect(geometry.stripHeight).toBeGreaterThan(0)

  // Every tab gets a share of the strip. A pill that collapses to 0px is invisible even when it
  // is still in the DOM, which is exactly how the strip looked empty.
  expect(geometry.tabWidths.filter((width) => width <= 0)).toEqual([])

  // Nothing above the strip shrank to content, and no box is narrower than what it holds. A
  // collapsed flex chain shows up as an ancestor narrower than its descendant.
  expect(geometry.chainWidths[0]).toBe(geometry.stripWidth)
  for (const width of geometry.chainWidths) {
    expect(width).toBeGreaterThan(400)
  }
})

test('the tab chrome adds up to the 36px header the sidebars use', async ({ orcaPage }) => {
  await orcaPage.setViewportSize({ width: 1280, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)

  const groupId = await ensureTabs(orcaPage, worktreeId, 1)

  // Why arithmetic and not a side-by-side box comparison: the left sidebar's own top bar is the
  // window titlebar segment, so it has no element starting at y=0 to compare against. What must
  // hold is that the 4px drag strip plus the row reconstruct exactly the 36px the sidebars use
  // (h-[36px] in right-sidebar-top-activity-bar.tsx and RightSidebar.tsx). A row that grows even
  // one pixel ends the rule below the right sidebar's header and the three top bars look ragged.
  const chrome = await orcaPage.evaluate((group) => {
    const box = (selector: string): { top: number; bottom: number; height: number } | null => {
      const el = document.querySelector<HTMLElement>(selector)
      if (!el) {
        return null
      }
      const rect = el.getBoundingClientRect()
      return { top: rect.top, bottom: rect.bottom, height: rect.height }
    }
    return {
      dragStrip: box('[data-terminal-focus-release-surface="true"]'),
      row: box(`[data-tab-group-strip-id="${group}"]`),
      rightHeader: box('.right-sidebar-header-drag')
    }
  }, groupId)

  expect(chrome.dragStrip).not.toBeNull()
  expect(chrome.row).not.toBeNull()

  const dragStrip = chrome.dragStrip!
  const row = chrome.row!

  // The row begins where the drag strip ends, so the two stack without a gap or an overlap.
  expect(Math.abs(row.top - dragStrip.bottom)).toBeLessThanOrEqual(1)
  // Together they cover the same 36px band the sidebar headers occupy.
  expect(Math.abs(dragStrip.height + row.height - 36)).toBeLessThanOrEqual(1)
  // Both start at the window's top edge: the drag strip carries the whole offset.
  expect(Math.abs(dragStrip.top)).toBeLessThanOrEqual(1)

  // Where a right sidebar header exists it is that same 36px band, so the rule must line up with
  // its bottom edge. Guarded on presence because the sidebar can be closed.
  if (chrome.rightHeader) {
    expect(Math.abs(row.bottom - chrome.rightHeader.bottom)).toBeLessThanOrEqual(1)
  }
})
