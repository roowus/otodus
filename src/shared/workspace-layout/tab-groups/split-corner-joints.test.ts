import { describe, expect, it } from 'vitest'
import { isGrabbableJoint, resolveSplitCornerJoints } from './split-corner-joints'

/** Handles as measured in a real 2x2 window at 1280x800: two rows of panes, one column seam. */
const ALIGNED_2X2 = [
  // left column's horizontal seam
  { index: 0, direction: 'horizontal' as const, left: 281, top: 384, right: 600, bottom: 390 },
  // the vertical seam spanning both rows
  { index: 1, direction: 'vertical' as const, left: 600, top: 4, right: 606, bottom: 776 },
  // right column's horizontal seam, at the same height
  { index: 2, direction: 'horizontal' as const, left: 606, top: 384, right: 933, bottom: 390 }
]

/** An L-shape: the right column splits lower than the left, so the horizontal seams never align. */
const MISALIGNED = [
  { index: 0, direction: 'horizontal' as const, left: 281, top: 384, right: 600, bottom: 390 },
  { index: 1, direction: 'vertical' as const, left: 600, top: 4, right: 606, bottom: 776 },
  { index: 2, direction: 'horizontal' as const, left: 606, top: 500, right: 933, bottom: 506 }
]

describe('split corner joints', () => {
  it('finds one joint where both columns split at the same height', () => {
    const joints = resolveSplitCornerJoints(ALIGNED_2X2)
    expect(joints).toHaveLength(1)
    // Both horizontal seams and the single vertical seam move with one grip.
    expect(joints[0].horizontal.sort()).toEqual([0, 2])
    expect(joints[0].vertical).toEqual([1])
    expect(joints[0].x).toBe(603)
    expect(joints[0].y).toBe(387)
  })

  it('finds a joint at each end of the vertical seam when the rows do not align', () => {
    const joints = resolveSplitCornerJoints(MISALIGNED)
    // Two T-junctions, not one cross: the left seam and the right seam each meet the vertical.
    expect(joints).toHaveLength(2)
    expect(joints.map((joint) => joint.y).sort((a, b) => a - b)).toEqual([387, 503])
    for (const joint of joints) {
      expect(joint.horizontal).toHaveLength(1)
      expect(joint.vertical).toEqual([1])
    }
  })

  it('does not join a seam whose line stops short of the other', () => {
    const disjoint = [
      // A horizontal seam on the left half only.
      { index: 0, direction: 'horizontal' as const, left: 100, top: 300, right: 400, bottom: 306 },
      // A vertical seam far to the right of it.
      { index: 1, direction: 'vertical' as const, left: 800, top: 0, right: 806, bottom: 700 }
    ]
    expect(resolveSplitCornerJoints(disjoint)).toEqual([])
  })

  it('has no joint in a layout with a single direction of split', () => {
    const columnsOnly = [
      { index: 0, direction: 'vertical' as const, left: 600, top: 4, right: 606, bottom: 776 }
    ]
    expect(resolveSplitCornerJoints(columnsOnly)).toEqual([])
  })

  it('only calls a joint grabbable when both axes are present', () => {
    expect(isGrabbableJoint({ horizontal: [0], vertical: [1], x: 0, y: 0 })).toBe(true)
    expect(isGrabbableJoint({ horizontal: [], vertical: [1], x: 0, y: 0 })).toBe(false)
    expect(isGrabbableJoint({ horizontal: [0], vertical: [], x: 0, y: 0 })).toBe(false)
  })
})
