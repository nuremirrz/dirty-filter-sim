import * as THREE from 'three'
import type { SceneContext } from './scene'

const GRILLE_NAME = 'return_grille'

// How far the grille slides aside. It is ~1.28 wide on X, so this clears it.
// Negative X, because from the return camera that reads as sliding to the right.
const OPEN_OFFSET = new THREE.Vector3(-1.4, 0, 0)
const SLIDE_SECONDS = 0.7

const smoothstep = (t: number) => t * t * (3 - 2 * t)

export interface GrilleApi {
  open: () => void
  close: () => void
  /** Flips the grille between open and shut. */
  toggle: () => void
  /** True once it has fully slid aside — not while it is still moving. */
  isOpen: () => boolean
  /** True once it has fully slid shut. Deliberately not `!isOpen()`, which
   *  would also be true mid-slide. */
  isClosed: () => boolean
}

/**
 * Owns the return grille's slide. Openness belongs to the player rather than to
 * the script: they can slide it aside whenever they like, and the scripted steps
 * just drive the same open/close as a click would.
 */
export function createGrille(ctx: SceneContext): GrilleApi {
  let grille: THREE.Object3D | null = null
  let closedPos: THREE.Vector3 | null = null
  let openness = 0 // 0 = shut, 1 = fully aside
  let target = 0

  // The GLB loads asynchronously, so keep retrying until the node shows up.
  const resolve = () => {
    if (grille) return
    grille = ctx.scene.getObjectByName(GRILLE_NAME) ?? null
    if (grille) closedPos = grille.position.clone()
  }

  ctx.onFrame((dt) => {
    if (openness === target) return
    resolve()
    if (!grille || !closedPos) return
    const step = dt / SLIDE_SECONDS
    openness =
      target > openness ? Math.min(target, openness + step) : Math.max(target, openness - step)
    grille.position.copy(closedPos).addScaledVector(OPEN_OFFSET, smoothstep(openness))
  })

  const set = (open: boolean) => {
    resolve()
    target = open ? 1 : 0
  }

  return {
    open: () => set(true),
    close: () => set(false),
    toggle: () => set(target === 0),
    isOpen: () => openness >= 1,
    isClosed: () => openness <= 0,
  }
}
