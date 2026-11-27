// A split's resize handle is a full-width (or full-height) strip. Where two strips cross, a grip
// there moves both seams at once, which a single handle cannot express. This resolves those
// crossings from measured rects, so it works for an aligned 2x2 and for an L-shape alike.

export type SplitSeam = {
  /** Index into the measured handle list; stable within one resolution. */
  index: number
  direction: 'horizontal' | 'vertical'
  /** Screen rect of the handle's box. */
  left: number
  top: number
  right: number
  bottom: number
  /** Painted seam, along the handle's short axis. Derived by the resolver. */
  seam?: { x: number; y: number }
}

export type SplitCornerJoint = {
  /** Horizontal seam indices and vertical seam indices meeting here, each moving on drag. */
  horizontal: number[]
  vertical: number[]
  /** Centre of the grip: where the seams cross, or where the two edges meet. */
  x: number
  y: number
}

/** A handle's painted seam is its centre line, since the box straddles it either way. */
export function seamOf(handle: {
  direction: 'horizontal' | 'vertical'
  left: number
  top: number
  right: number
  bottom: number
}): SplitSeam['seam'] {
  return { x: (handle.left + handle.right) / 2, y: (handle.top + handle.bottom) / 2 }
}

const within = (value: number, from: number, to: number, tolerance: number): boolean =>
  value >= Math.min(from, to) - tolerance && value <= Math.max(from, to) + tolerance

/**
 * Every place a horizontal and a vertical seam meet.
 *
 * Two shapes count: a crossing, where both seam lines pass through the same point (a true 2x2),
 * and an edge meeting, where a horizontal seam stops at a vertical one (an L-shape). Both are a
 * joint the pointer can grab; the T-junction keeps each seam where it is instead of snapping the
 * panes into a cross.
 */
export function resolveSplitCornerJoints(
  handles: readonly SplitSeam[],
  tolerance = 3
): SplitCornerJoint[] {
  // Derive the seam here rather than trusting each caller to precompute it.
  const withSeams = handles.map((handle) => ({
    ...handle,
    seam: handle.seam ?? seamOf(handle)
  }))
  // `seam` is total after the map above; the type keeps it optional for callers that pass rects.
  type Measured = SplitSeam & { seam: { x: number; y: number } }
  const horizontals = withSeams.filter(
    (handle): handle is Measured => handle.direction === 'horizontal'
  )
  const verticals = withSeams.filter(
    (handle): handle is Measured => handle.direction === 'vertical'
  )
  const joints: SplitCornerJoint[] = []

  for (const horizontal of horizontals) {
    for (const vertical of verticals) {
      const y = horizontal.seam.y
      const x = vertical.seam.x
      // The join has to be near both spans: the vertical seam must pass this height and the
      // horizontal seam must pass this width. Otherwise the two strips are unrelated.
      if (
        !within(y, vertical.top, vertical.bottom, tolerance) ||
        !within(x, horizontal.left, horizontal.right, tolerance)
      ) {
        continue
      }
      const existing = joints.find(
        (joint) => Math.abs(joint.x - x) <= tolerance && Math.abs(joint.y - y) <= tolerance
      )
      if (existing) {
        if (!existing.horizontal.includes(horizontal.index)) {
          existing.horizontal.push(horizontal.index)
        }
        if (!existing.vertical.includes(vertical.index)) {
          existing.vertical.push(vertical.index)
        }
        continue
      }
      joints.push({
        horizontal: [horizontal.index],
        vertical: [vertical.index],
        x,
        y
      })
    }
  }
  return joints
}

/** A joint needs both axes, so one seam's stray end against another is not enough to be a grip. */
export function isGrabbableJoint(joint: SplitCornerJoint): boolean {
  return joint.horizontal.length > 0 && joint.vertical.length > 0
}
