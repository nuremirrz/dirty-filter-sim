import * as THREE from 'three'
import type { SceneContext } from './scene'

const FILTER_NAME = 'filter'

// The filter sits in a ceiling housing, so it comes straight down out of the
// opening rather than sideways: dirty drops out, clean rises back up into it.
const OUT_OFFSET = new THREE.Vector3(0, -1.2, 0)

// The swap has three beats over its full length: the dirty panel lowers out, a
// short hold with the housing empty, then the fresh panel rises in. The pause in
// the middle keeps it from reading as one fast flicker.
const SWAP_SECONDS = 2.6
const OUT_END = 0.42 // dirty is fully out by here
const IN_START = 0.58 // fresh starts rising here; the gap between is the empty hold
const CLEAN_COLOR = 0xf0f0f0

const smoothstep = (t: number) => t * t * (3 - 2 * t)

export interface FilterApi {
  /** Draws the dirty filter out and slides a clean one in. Runs once. */
  replace: () => void
  /** True once the clean filter is in place. */
  isReplaced: () => boolean
}

/** Gives an object its own light material, so the original keeps its grey one. */
function paintClean(obj: THREE.Object3D): void {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const source = Array.isArray(child.material) ? child.material[0] : child.material
    const material = source.clone() as THREE.Material & { color?: THREE.Color }
    if (material.color) material.color.setHex(CLEAN_COLOR)
    child.material = material
  })
}

/**
 * Swaps the dirty filter for a clean one. The spare is cloned from the original
 * at load time, so no extra geometry is needed in the GLB — same panel, own
 * material.
 *
 * `canReplace` gates every route in one place: the panel sits behind the grille,
 * so it must not be swapped while the grille is shut. Clicking it happens to be
 * blocked anyway (the grille catches the ray first), but that is geometry, not a
 * rule — the button needs the same answer.
 */
export function createFilter(ctx: SceneContext, canReplace: () => boolean): FilterApi {
  let dirty: THREE.Object3D | null = null
  let clean: THREE.Object3D | null = null
  let homePos: THREE.Vector3 | null = null
  let progress = 0
  let running = false
  let replaced = false

  // The GLB loads asynchronously, so keep retrying until the node shows up.
  const resolve = () => {
    if (dirty) return
    const found = ctx.scene.getObjectByName(FILTER_NAME)
    if (!found?.parent) return

    dirty = found
    homePos = found.position.clone()

    const spare = found.clone()
    spare.name = 'filter_clean'
    spare.visible = false
    paintClean(spare)
    // Added as a sibling so it shares the original's parent transform.
    found.parent.add(spare)
    clean = spare
  }

  ctx.onFrame((dt) => {
    if (!running) return
    resolve()
    if (!dirty || !clean || !homePos) return

    progress = Math.min(1, progress + dt / SWAP_SECONDS)
    if (progress < OUT_END) {
      // Beat one: the dirty panel lowers out of the housing.
      const t = smoothstep(progress / OUT_END)
      dirty.visible = true
      dirty.position.copy(homePos).addScaledVector(OUT_OFFSET, t)
      clean.visible = false
    } else if (progress < IN_START) {
      // Beat two: a held moment with the housing empty.
      dirty.visible = false
      clean.visible = false
    } else {
      // Beat three: the fresh panel rises into its place.
      const t = smoothstep((progress - IN_START) / (1 - IN_START))
      dirty.visible = false
      clean.visible = true
      clean.position.copy(homePos).addScaledVector(OUT_OFFSET, 1 - t)
    }

    if (progress >= 1) {
      running = false
      replaced = true
    }
  })

  return {
    replace() {
      if (!canReplace()) return
      resolve()
      if (replaced || running) return
      progress = 0
      running = true
    },
    isReplaced: () => replaced,
  }
}
