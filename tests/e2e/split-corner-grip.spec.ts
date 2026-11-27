import type { Page } from '@stablyai/playwright-test'
import { test, expect } from './helpers/orca-app'
import { ensureTerminalVisible, waitForActiveWorktree, waitForSessionReady } from './helpers/store'

/** Builds a 2x2 of tab groups and returns the four group ids. */
async function buildQuad(page: Page, worktreeId: string): Promise<string[]> {
  return page.evaluate((id) => {
    const st = () => window.__store!.getState()
    const root = st().activeGroupIdByWorktree[id]!
    const right = st().createEmptySplitGroup(id, root, 'right')!
    st().createEmptySplitGroup(id, root, 'down')
    st().createEmptySplitGroup(id, right, 'down')
    type Node = { type: 'leaf'; groupId: string } | { type: 'split'; first: Node; second: Node }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the store types layout loosely; this walk only reads the fields it names.
    const layout = st().layoutByWorktree[id] as unknown as Node
    const ids: string[] = []
    const walk = (node: Node): void => {
      if (node.type === 'leaf') {
        ids.push(node.groupId)
        return
      }
      walk(node.first)
      walk(node.second)
    }
    walk(layout)
    for (const groupId of ids) {
      st().createTab(id, groupId, undefined, { activate: false })
    }
    return ids
  }, worktreeId)
}

type Seams = {
  grips: { x: number; y: number }[]
  horizontals: number[]
  verticals: number[]
}

async function readSeams(page: Page): Promise<Seams> {
  return page.evaluate(() => {
    const handles = [...document.querySelectorAll<HTMLElement>('.tab-group-split-resize-handle')]
    const centre = (el: HTMLElement): number => {
      const r = el.getBoundingClientRect()
      return el.classList.contains('is-horizontal')
        ? Math.round(r.top + r.height / 2)
        : Math.round(r.left + r.width / 2)
    }
    return {
      grips: [...document.querySelectorAll<HTMLElement>('.split-corner-grip')].map((el) => {
        const r = el.getBoundingClientRect()
        return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }
      }),
      horizontals: handles.filter((el) => el.classList.contains('is-horizontal')).map(centre),
      verticals: handles.filter((el) => el.classList.contains('is-vertical')).map(centre)
    }
  })
}

test('a corner grip appears where a 2x2 meets, and dragging it moves both seams', async ({
  orcaPage
}) => {
  await orcaPage.setViewportSize({ width: 1280, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await buildQuad(orcaPage, worktreeId)

  // An aligned 2x2 has exactly one joint: both horizontal seams sit at one height.
  await expect.poll(async () => (await readSeams(orcaPage)).grips.length).toBe(1)
  const before = await readSeams(orcaPage)
  expect(before.horizontals).toHaveLength(2)
  expect(before.verticals).toHaveLength(1)

  // The grip has to sit on the crossing, not merely exist: positioning it against the wrong
  // containing block put it 280px away, welded to a pane edge instead of the joint.
  const grip = before.grips[0]
  expect(Math.abs(grip.x - before.verticals[0])).toBeLessThanOrEqual(3)
  for (const y of before.horizontals) {
    expect(Math.abs(grip.y - y)).toBeLessThanOrEqual(3)
  }
  await orcaPage.mouse.move(grip.x, grip.y)
  await orcaPage.mouse.down()
  // Move right and down: crosses the vertical seam and both horizontal seams at once.
  await orcaPage.mouse.move(grip.x + 60, grip.y + 40, { steps: 8 })
  await orcaPage.mouse.up()

  await expect
    .poll(async () => {
      const after = await readSeams(orcaPage)
      return {
        verticalMoved: after.verticals.some((x) => Math.abs(x - before.verticals[0]) > 20),
        horizontalsMoved: after.horizontals.every(
          (y, i) => Math.abs(y - before.horizontals[i]) > 20
        )
      }
    })
    .toEqual({ verticalMoved: true, horizontalsMoved: true })

  // The drag has to land in the model, not just in inline flex styles: every split the grip moved
  // must persist, or the layout snaps back on the next render or reload.
  const persisted = await orcaPage.evaluate((id) => {
    type Node = { type: 'leaf' } | { type: 'split'; ratio?: number; first: Node; second: Node }
    // oxlint-disable-next-line typescript/consistent-type-assertions -- SAFETY: the store types layout loosely; this walk only reads ratios.
    const layout = window.__store!.getState().layoutByWorktree[id] as unknown as Node
    const ratios: number[] = []
    const walk = (node: Node): void => {
      if (node.type !== 'split') {
        return
      }
      ratios.push(node.ratio ?? 0.5)
      walk(node.first)
      walk(node.second)
    }
    walk(layout)
    return ratios
  }, worktreeId)
  // Root vertical seam plus both horizontal seams all left their 0.5 default.
  expect(persisted.filter((ratio) => Math.abs(ratio - 0.5) > 0.02)).toHaveLength(3)
})

test('an L-shaped layout gets a grip at each seam where they meet', async ({ orcaPage }) => {
  await orcaPage.setViewportSize({ width: 1280, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await buildQuad(orcaPage, worktreeId)

  // Move the right column's split lower, so the two horizontal seams no longer align.
  const rightPath = 'second'
  await orcaPage.evaluate(
    ({ id, path }) => window.__store!.getState().setTabGroupSplitRatio(id, path, 0.72),
    { id: worktreeId, path: rightPath }
  )

  await expect.poll(async () => (await readSeams(orcaPage)).grips.length).toBe(2)
})

test('dragging an L-shape T-grip moves its own seam and the column seam, not the far one', async ({
  orcaPage
}) => {
  await orcaPage.setViewportSize({ width: 1280, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await buildQuad(orcaPage, worktreeId)

  // Lower the right column's split so the two horizontal seams land at different heights.
  await orcaPage.evaluate(
    (id) => window.__store!.getState().setTabGroupSplitRatio(id, 'second', 0.72),
    worktreeId
  )
  await expect.poll(async () => (await readSeams(orcaPage)).grips.length).toBe(2)

  // Poll until both seams have actually moved apart AND both grips are placed; an L-shape shows
  // two joints only once the height difference exceeds the resolver's tolerance, and the grip
  // layer re-measures on its own frame.
  await expect
    .poll(async () => {
      const seams = await readSeams(orcaPage)
      const spread = Math.abs(seams.horizontals[0] - seams.horizontals[1])
      return seams.grips.length === 2 && spread > 10
    })
    .toBe(true)
  const before = await readSeams(orcaPage)
  const upper = [...before.grips].sort((a, b) => a.y - b.y)[0]
  const horizontalsBefore = [...before.horizontals].sort((a, b) => a - b)

  await orcaPage.mouse.move(upper.x, upper.y)
  await orcaPage.mouse.down()
  await orcaPage.mouse.move(upper.x + 40, upper.y + 80, { steps: 8 })
  await orcaPage.mouse.up()

  const after = await readSeams(orcaPage)
  const horizontalsAfter = [...after.horizontals].sort((a, b) => a - b)
  // The upper T owns the top horizontal seam, so only that one may follow the pointer.
  expect(Math.abs(horizontalsAfter[0] - horizontalsBefore[0])).toBeGreaterThan(20)
  expect(Math.abs(horizontalsAfter[1] - horizontalsBefore[1])).toBeLessThanOrEqual(1)
  // The column seam moves too, since the grip carries it.
  expect(Math.abs(after.verticals[0] - before.verticals[0])).toBeGreaterThan(15)
})

/**
 * A press alone must not move anything. The first version computed each seam's ratio from the
 * pointer's absolute position, so the seam jumped to the cursor on pointerdown instead of
 * following the drag; Truss's implementation diffs against the grab point for this reason.
 */
test('pressing a corner grip without dragging leaves every seam where it was', async ({
  orcaPage
}) => {
  await orcaPage.setViewportSize({ width: 1280, height: 800 })
  await waitForSessionReady(orcaPage)
  const worktreeId = await waitForActiveWorktree(orcaPage)
  await ensureTerminalVisible(orcaPage)
  await buildQuad(orcaPage, worktreeId)
  await expect.poll(async () => (await readSeams(orcaPage)).grips.length).toBe(1)

  const before = await readSeams(orcaPage)
  const grip = before.grips[0]
  await orcaPage.mouse.move(grip.x, grip.y)
  await orcaPage.mouse.down()
  // One pixel, then release: a grab-time delta moves at most a pixel or two.
  await orcaPage.mouse.move(grip.x + 1, grip.y + 1, { steps: 2 })
  await orcaPage.mouse.up()

  const after = await readSeams(orcaPage)
  const seamPositions = (seams: Seams): number[] => [...seams.horizontals, ...seams.verticals]
  const moved = seamPositions(after).map((value, index) =>
    Math.abs(value - seamPositions(before)[index])
  )
  for (const delta of moved) {
    expect(delta).toBeLessThanOrEqual(2)
  }
})
