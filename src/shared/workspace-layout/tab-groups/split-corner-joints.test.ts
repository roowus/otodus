import { describe, expect, it } from 'vitest'
import {
  grabbableQuadrants,
  isGrabbableJoint,
  resolveSplitCornerJoints
} from './split-corner-joints'

/** Handles as measured in a real 2x2 window at 1280x800: two rows of panes, one column seam. */
const box = (
  index: number,
  direction: 'horizontal' | 'vertical',
  left: number,
  top: number,
  right: number,
  bottom: number
) => ({ index, direction, left, top, right, bottom, width: right - left, height: bottom - top })

const ALIGNED_2X2 = [
  // left column's horizontal seam
  box(0, 'horizontal', 281, 384, 600, 390),
  // the vertical seam spanning both rows
  box(1, 'vertical', 600, 4, 606, 776),
  // right column's horizontal seam, at the same height
  box(2, 'horizontal', 606, 384, 933, 390)
]

/** An L-shape: the right column splits lower than the left, so the horizontal seams never align. */
const MISALIGNED = [
  box(0, 'horizontal', 281, 384, 600, 390),
  box(1, 'vertical', 600, 4, 606, 776),
  box(2, 'horizontal', 606, 500, 933, 506)
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
      box(0, 'horizontal', 100, 300, 400, 306),
      // A vertical seam far to the right of it.
      box(1, 'vertical', 800, 0, 806, 700)
    ]
    expect(resolveSplitCornerJoints(disjoint)).toEqual([])
  })

  it('has no joint in a layout with a single direction of split', () => {
    const columnsOnly = [box(0, 'vertical', 600, 4, 606, 776)]
    expect(resolveSplitCornerJoints(columnsOnly)).toEqual([])
  })

  it('only calls a joint grabbable when both axes are present', () => {
    expect(isGrabbableJoint({ horizontal: [0], vertical: [1], x: 0, y: 0 })).toBe(true)
    expect(isGrabbableJoint({ horizontal: [], vertical: [1], x: 0, y: 0 })).toBe(false)
    expect(isGrabbableJoint({ horizontal: [0], vertical: [], x: 0, y: 0 })).toBe(false)
  })
})

describe('which crossings are grabbable', () => {
  it('accepts four distinct panes, the classic cross', () => {
    expect(grabbableQuadrants({ tl: 'a', tr: 'b', bl: 'c', br: 'd' })).toBe(true)
  })

  it('accepts three, because a T has one pane spanning two quadrants', () => {
    // Truss's rule (issue #187): a T is a junction, not a gap.
    expect(grabbableQuadrants({ tl: 'top', tr: 'top', bl: 'a', br: 'b' })).toBe(true)
    expect(grabbableQuadrants({ tl: 'left', tr: 'a', bl: 'left', br: 'b' })).toBe(true)
  })

  it('rejects two, where only a corner exists and the far side has no pane', () => {
    expect(grabbableQuadrants({ tl: 'left', tr: 'right', bl: 'left', br: 'right' })).toBe(false)
  })

  it('rejects one, the inside of a single pane', () => {
    expect(grabbableQuadrants({ tl: 'a', tr: 'a', bl: 'a', br: 'a' })).toBe(false)
  })

  it('treats an unsampled quadrant as absent rather than as a pane', () => {
    expect(grabbableQuadrants({ tl: 'a', tr: 'b', bl: null, br: null })).toBe(false)
  })
})

describe('a T junction, as measured in the live app', () => {
  it('still refuses seams that genuinely do not meet', () => {
    // 100px apart is a real gap, not a handle's half-width.
    const apart = [box(0, 'horizontal', 100, 300, 400, 306), box(1, 'vertical', 500, 0, 506, 700)]
    expect(resolveSplitCornerJoints(apart)).toEqual([])
  })

  it('finds both ends of a column seam in a three-pane T', () => {
    // Measured in the live app: one spanning pane above, a column split below. Both crossings are
    // joints, which is why a T gets two grips, not one.
    const tee = [
      box(0, 'horizontal', 281, 557, 1162, 563),
      box(1, 'horizontal', 281, 741, 719, 747),
      box(2, 'vertical', 719, 563, 725, 925)
    ]
    const joints = resolveSplitCornerJoints(tee)
    expect(joints).toHaveLength(2)
    expect(joints.map((joint) => Math.round(joint.y)).sort((a, b) => a - b)).toEqual([560, 744])
    expect(joints.every((joint) => Math.round(joint.x) === 722)).toBe(true)
  })
})
