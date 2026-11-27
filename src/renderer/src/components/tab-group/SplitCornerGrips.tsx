import { useCallback, useEffect, useRef, useState } from 'react'
import {
  isGrabbableJoint,
  resolveSplitCornerJoints,
  type SplitCornerJoint,
  type SplitSeam
} from '../../../../shared/workspace-layout/tab-groups/split-corner-joints'
import { acquireWebviewsDragPassthrough } from '../browser-pane/host-guest/drag/webview-drag-passthrough'

/** Matches the resize handle's 15–85% travel so a corner cannot collapse a pane. */
const MIN_RATIO = 0.15
const MAX_RATIO = 0.85

/** One seam the grip moves: which handle to resize around and the box its ratio is measured in. */
type SeamDrag = {
  handleIndex: number
  direction: 'horizontal' | 'vertical'
  /** The split's own box (the container holding its two panes and this handle). */
  container: HTMLElement
  firstPane: HTMLElement
  secondPane: HTMLElement
}

/** The seam a handle carries: `is-vertical` means a vertical divider, which drags horizontally. */
function seamDirection(element: HTMLElement): 'horizontal' | 'vertical' {
  return element.classList.contains('is-vertical') ? 'horizontal' : 'vertical'
}

/** Reads the live seams and returns a joint's drags, or none if the DOM no longer matches. */
function seamsForJoint(joint: SplitCornerJoint): SeamDrag[] {
  const handles = [...document.querySelectorAll<HTMLElement>('.tab-group-split-resize-handle')]
  return [...joint.horizontal, ...joint.vertical].flatMap((index) => {
    const handle = handles[index]
    const container = handle?.parentElement
    const firstPane = handle?.previousElementSibling
    const secondPane = handle?.nextElementSibling
    if (!container || !(firstPane instanceof HTMLElement) || !(secondPane instanceof HTMLElement)) {
      return []
    }
    return [
      { handleIndex: index, direction: seamDirection(handle), container, firstPane, secondPane }
    ]
  })
}

/** Measures the handles in this subtree and returns the joints between their seams. */
function measureJoints(root: HTMLElement): { joints: SplitCornerJoint[]; handles: SplitSeam[] } {
  const handles: SplitSeam[] = [
    ...root.querySelectorAll<HTMLElement>('.tab-group-split-resize-handle')
  ].map((element, index) => {
    const rect = element.getBoundingClientRect()
    return {
      index,
      direction: seamDirection(element) === 'horizontal' ? 'vertical' : 'horizontal',
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom
    }
  })
  // A joint is a page coordinate, but a grip's left/top are local to its containing block (the
  // overlay, which fills the tree's relative wrapper). Convert here, in the same frame as the
  // measurement, subtracting that wrapper's own origin on both axes.
  const origin = root.getBoundingClientRect()
  const joints = resolveSplitCornerJoints(handles)
    .filter(isGrabbableJoint)
    .map((joint) => ({ ...joint, x: joint.x - origin.left, y: joint.y - origin.top }))
  return { joints, handles }
}

/**
 * Grips where split seams meet, so a corner can be dragged and both seams move together.
 *
 * The seams themselves belong to `ResizeHandle`; this only adds the crossings, because a single
 * handle can only own one ratio and a corner needs two. Positions are measured from the live
 * handles rather than derived from the layout tree, so an aligned 2x2 and an L-shape both work.
 */
export function SplitCornerGrips({
  rootRef,
  onRatiosChange
}: {
  rootRef: React.RefObject<HTMLElement | null>
  /** Commit every seam the grip moved, in one update, so the pair cannot land skewed. */
  onRatiosChange: (ratios: { handleIndex: number; ratio: number }[]) => void
}) {
  const [joints, setJoints] = useState<SplitCornerJoint[]>([])
  const [dragging, setDragging] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Re-measure when the tree changes shape or the window resizes; the handles move with both.
  useEffect(() => {
    const root = rootRef.current
    if (!root) {
      return
    }
    let frame = 0
    const measure = (): void => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        setJoints((current) => {
          const next = measureJoints(root).joints
          // Keep identity when nothing moved, so a hovered grip is not recreated mid-gesture.
          const same =
            current.length === next.length &&
            current.every(
              (joint, index) =>
                Math.abs(joint.x - next[index].x) < 0.5 && Math.abs(joint.y - next[index].y) < 0.5
            )
          return same ? current : next
        })
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    const mutation = new MutationObserver(measure)
    mutation.observe(root, { childList: true, subtree: true })
    window.addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      mutation.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [rootRef])

  useEffect(() => () => cleanupRef.current?.(), [])

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>, joint: SplitCornerJoint) => {
      // Why: the seams' own handlers must not also start a single-axis drag from this press.
      event.preventDefault()
      event.stopPropagation()
      if (cleanupRef.current) {
        return
      }
      const drags = seamsForJoint(joint)
      if (drags.length === 0) {
        return
      }
      const handle = event.currentTarget
      const pointerId = event.pointerId
      handle.setPointerCapture(pointerId)
      setDragging(true)
      const releaseWebviewDragPassthrough = acquireWebviewsDragPassthrough()
      const rects = drags.map((drag) => drag.container.getBoundingClientRect())
      const dragged: { handleIndex: number; ratio: number }[] = []

      const onPointerMove = (moveEvent: PointerEvent): void => {
        if (moveEvent.pointerId !== pointerId) {
          return
        }
        // A release outside the window arrives as a buttonless move rather than pointerup.
        if (moveEvent.buttons === 0) {
          cleanup()
          return
        }
        drags.forEach((drag, index) => {
          const rect = rects[index]
          const ratio =
            drag.direction === 'horizontal'
              ? (moveEvent.clientX - rect.left) / rect.width
              : (moveEvent.clientY - rect.top) / rect.height
          const clamped = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio))
          // Write during the drag, as the single-seam handle does, and commit once on release.
          drag.firstPane.style.flex = `${clamped} 1 0%`
          drag.secondPane.style.flex = `${1 - clamped} 1 0%`
          dragged[index] = { handleIndex: drag.handleIndex, ratio: clamped }
        })
      }

      const cleanup = (): void => {
        if (cleanupRef.current !== cleanup) {
          return
        }
        cleanupRef.current = null
        releaseWebviewDragPassthrough()
        setDragging(false)
        const committed = dragged.filter(Boolean)
        if (committed.length > 0) {
          onRatiosChange(committed)
        }
        try {
          if (handle.hasPointerCapture(pointerId)) {
            handle.releasePointerCapture(pointerId)
          }
        } catch {
          // Best effort: unmount cleanup can run after Chromium already dropped capture.
        }
        window.removeEventListener('pointermove', onPointerMove)
        window.removeEventListener('pointerup', onPointerUp)
        window.removeEventListener('pointercancel', onPointerUp)
        window.removeEventListener('blur', onPointerUp)
      }

      const onPointerUp = (upEvent: Event): void => {
        // Blur is not a pointer event; it ends the gesture unconditionally.
        if (!('pointerId' in upEvent) || upEvent.pointerId === pointerId) {
          cleanup()
        }
      }

      window.addEventListener('pointermove', onPointerMove)
      window.addEventListener('pointerup', onPointerUp)
      window.addEventListener('pointercancel', onPointerUp)
      // A release outside a blurred window may never arrive; end the gesture so guests take input.
      window.addEventListener('blur', onPointerUp)
      cleanupRef.current = cleanup
    },
    [onRatiosChange]
  )

  if (joints.length === 0) {
    return null
  }
  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {joints.map((joint) => (
        <div
          key={`${Math.round(joint.x)}:${Math.round(joint.y)}`}
          // The overlay receives page coordinates: it is positioned in the same viewport, so no
          // containing-block maths is involved and nothing is subtracted twice.
          className={`split-corner-grip${dragging ? ' is-dragging' : ''}`}
          style={{ left: joint.x, top: joint.y }}
          onPointerDown={(event) => onPointerDown(event, joint)}
        />
      ))}
    </div>
  )
}
