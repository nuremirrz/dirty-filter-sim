import * as THREE from 'three'
import type { SceneContext } from '@hvac/engine'

// The filter panel sits in the housing above the return grille. House_final.glb
// names the panels behind each grille cap_N; cap_2 is the one over the return,
// and it carries the same 1.09 × 0.64 footprint the old `filter` node had.
const FILTER_NAME = 'cap_2'

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

// The dirty panel's look, painted into a canvas so the grime lives in the
// texture rather than the model: a dusty tan field, a dark stain blooming out of
// the centre (where the return pulls air through and dust cakes up), and a
// scatter of specks so it reads as filthy, not merely tinted.
const DIRTY_BASE = '#b0a488' // dusty tan field
const STAIN_CORE = 'rgba(38, 30, 22, 0.94)' // near-black at the centre
const STAIN_MID = 'rgba(74, 60, 44, 0.55)'
const STAIN_EDGE = 'rgba(120, 104, 80, 0)' // fades into the field

/**
 * Builds the dirty filter's surface as a CanvasTexture: tan base, a central
 * radial stain, and low-alpha speckle for grime. Drawn once and reused.
 */
function makeDirtyTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const cx = canvas.getContext('2d')!

  cx.fillStyle = DIRTY_BASE
  cx.fillRect(0, 0, size, size)

  // Grime speckle: many small, faint dark dots spread across the field.
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = 1 + Math.random() * 3
    cx.fillStyle = `rgba(60, 48, 36, ${0.05 + Math.random() * 0.12})`
    cx.beginPath()
    cx.arc(x, y, r, 0, Math.PI * 2)
    cx.fill()
  }

  // Central stain: a dark bloom, densest at the middle, fading into the field.
  const half = size / 2
  const stain = cx.createRadialGradient(half, half, size * 0.04, half, half, size * 0.46)
  stain.addColorStop(0, STAIN_CORE)
  stain.addColorStop(0.5, STAIN_MID)
  stain.addColorStop(1, STAIN_EDGE)
  cx.fillStyle = stain
  cx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

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
 * Gives the panel its own grimy material — the dusty texture with the centre
 * stain — so it plainly reads as the dirty filter next to the clean white spare.
 * Clones the material like paintClean, leaving the shared model one untouched.
 */
function paintDirty(obj: THREE.Object3D): void {
  const map = makeDirtyTexture()
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const source = Array.isArray(child.material) ? child.material[0] : child.material
    const material = source.clone() as THREE.Material & {
      color?: THREE.Color
      map?: THREE.Texture | null
      roughness?: number
      metalness?: number
    }
    // White base so the texture's own colours show true; matte, like fabric.
    if (material.color) material.color.setHex(0xffffff)
    if ('map' in material) material.map = map
    if (typeof material.roughness === 'number') material.roughness = 1
    if (typeof material.metalness === 'number') material.metalness = 0
    material.needsUpdate = true
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

    // Dirty the original last, once the clean spare is already cloned from it —
    // so the stain texture lands only on the dirty panel, never the clean one.
    paintDirty(dirty)
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
