import * as THREE from 'three'
import type { SceneContext } from './scene'
import type { GrilleApi } from './grille'
import type { FilterApi } from './filter'
import { flyToCameraPresetByName, activeCameraPreset } from './cameras'

interface ClickTarget {
  /** Camera preset this object flies to when clicked from afar. */
  preset: string
  /** Cameras that already frame this object, so travelling to it is pointless. */
  redundantFrom?: string[]
  /** What the object does when clicked from a camera that already frames it. */
  act?: () => void
  /** When present, the action is only offered while this returns true. */
  canAct?: () => boolean
}

/** Just enough of the HUD for the device's own button to work. */
interface ReadingTaker {
  takeReading: () => void
  canTakeReading: () => boolean
}

// A press that travels further than this (in px) is an orbit drag, not a click.
const DRAG_SLOP = 5

/**
 * Makes the level's objects hoverable and clickable. A click means "get closer"
 * until you are there, and "interact" once you are — so the grille flies you in
 * first, then opens and shuts on further clicks. OrbitControls keeps working;
 * drags are told apart from clicks by how far the pointer travelled.
 */
export function createInteractions(
  ctx: SceneContext,
  grille: GrilleApi,
  filter: FilterApi,
  hud: ReadingTaker,
): void {
  // Keys are GLB object names; `preset` is the camera preset they fly to.
  const clickTargets: Record<string, ClickTarget> = {
    supply_duct: { preset: 'supply_air' },
    // The device only exists while measuring, and the step already parks the
    // camera on it — so a click is always its own button, never a trip.
    anemometer: {
      preset: 'supply_air',
      act: () => hud.takeReading(),
      canAct: () => hud.canTakeReading(),
    },
    return_grille: { preset: 'return_air', act: () => grille.toggle() },
    // The filter sits right behind the grille, so the return camera already frames
    // it — no point flying closer, but it is very much clickable from there.
    // While the grille is shut it also blocks the ray, so it cannot be reached
    // through a closed grille without any explicit check.
    filter: {
      preset: 'air_filter',
      redundantFrom: ['return_air'],
      act: () => filter.replace(),
    },
  }

  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  const canvas = ctx.renderer.domElement
  let hovered: THREE.Object3D | null = null
  let pressX = 0
  let pressY = 0

  /** Returns the registered object under the pointer, if any. */
  const pick = (event: PointerEvent | MouseEvent): THREE.Object3D | null => {
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(event.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, ctx.camera)

    const targets: THREE.Object3D[] = []
    for (const name of Object.keys(clickTargets)) {
      const obj = ctx.scene.getObjectByName(name)
      if (obj?.visible) targets.push(obj)
    }
    const hit = raycaster.intersectObjects(targets, true)[0]
    if (!hit) return null

    // The hit may be a child mesh — walk up to the registered ancestor.
    let obj: THREE.Object3D | null = hit.object
    while (obj && !(obj.name in clickTargets)) obj = obj.parent
    return obj
  }

  /** True when the current camera already frames the object, by any route. */
  const framedAlready = (target: ClickTarget) => {
    const active = activeCameraPreset()
    if (!active) return false
    return target.preset === active || (target.redundantFrom?.includes(active) ?? false)
  }

  /**
   * The object under the pointer, but only while clicking it would do something:
   * travel to it, or run its action once it is already framed.
   */
  const pickActionable = (event: PointerEvent | MouseEvent): THREE.Object3D | null => {
    const obj = pick(event)
    if (!obj) return null
    const target = clickTargets[obj.name]
    if (!framedAlready(target)) return obj
    if (!target.act) return null
    return target.canAct?.() === false ? null : obj
  }

  const setHovered = (obj: THREE.Object3D | null) => {
    if (obj === hovered) return
    hovered = obj
    ctx.outline(obj ? [obj] : [])
    canvas.style.cursor = obj ? 'pointer' : ''
  }

  canvas.addEventListener('pointermove', (e) => setHovered(pickActionable(e)))
  canvas.addEventListener('pointerleave', () => setHovered(null))

  canvas.addEventListener('pointerdown', (e) => {
    pressX = e.clientX
    pressY = e.clientY
  })

  canvas.addEventListener('click', (e) => {
    if (Math.hypot(e.clientX - pressX, e.clientY - pressY) > DRAG_SLOP) return
    const obj = pickActionable(e)
    if (!obj) return

    const target = clickTargets[obj.name]
    if (framedAlready(target)) target.act?.()
    else flyToCameraPresetByName(ctx, target.preset)

    // Re-read hover against the new camera rather than waiting for a mouse move:
    // objects that stay actionable keep their outline, the rest drop it.
    setHovered(pickActionable(e))
  })
}
