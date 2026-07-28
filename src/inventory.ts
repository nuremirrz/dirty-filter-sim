import * as THREE from 'three'
import type { SceneContext } from './scene'
import type { GrilleApi } from './grille'
import type { FilterApi } from './filter'
import { t, onChange } from './i18n'

/** Just enough of the HUD for the anemometer tool to take a reading. */
interface ReadingTaker {
  takeReading: () => void
  canTakeReading: () => boolean
}

interface Tool {
  id: string
  labelKey: string
  iconNode: string // GLB node rendered into the tool's icon
  iconColor?: number // recolour the icon clone (e.g. clean filter)
  targetNodes: string[] // GLB nodes this tool can be dropped onto
  usable: () => boolean // is the tool applicable right now?
  apply: () => void // the action a valid drop performs
}

export interface InventoryApi {
  /** Renders each tool's icon from the model. Call once, post-load. */
  syncModel: () => void
}

const ICON = 256 // off-screen icon render size (downscaled in the card)

const el = (tag: string, css: string): HTMLElement => {
  const node = document.createElement(tag)
  node.style.cssText = css
  return node
}

/**
 * Inventory drawer (opened by a button): tools shown under SUGGESTED (usable
 * now) and ALL, each with an icon rendered from its 3D model. Dragging a tool
 * onto a valid object in the scene performs its action — an extra route
 * alongside the action button and direct clicks, not a replacement.
 */
export function createInventory(
  ctx: SceneContext,
  grille: GrilleApi,
  filter: FilterApi,
  hud: ReadingTaker,
): InventoryApi {
  const tools: Tool[] = [
    {
      id: 'anemometer',
      labelKey: 'tool.anemometer',
      iconNode: 'anemometer',
      // The device parks on the supply grille while measuring, so accept either.
      targetNodes: ['supply_duct', 'anemometer'],
      usable: () => hud.canTakeReading(),
      apply: () => hud.takeReading(),
    },
    {
      id: 'filter',
      labelKey: 'tool.clean_filter',
      iconNode: 'filter',
      iconColor: 0xf0f0f0, // show it as the clean spare
      targetNodes: ['filter'],
      usable: () => grille.isOpen() && !filter.isReplaced(),
      apply: () => filter.replace(),
    },
  ]

  const iconUrls: Record<string, string> = {}

  // --- Button + drawer ---
  const button = el(
    'button',
    [
      'position:fixed',
      'bottom:16px',
      'right:16px',
      'z-index:21',
      'padding:10px 16px',
      'font:inherit',
      'font-size:14px',
      'font-weight:600',
      'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif',
      'background:#ffffff',
      'color:#1f2430',
      'border:1px solid rgba(0,0,0,0.10)',
      'border-radius:10px',
      'box-shadow:0 6px 20px rgba(0,0,0,0.14)',
      'cursor:pointer',
    ].join(';'),
  )

  // A low, horizontal tray (SUGGESTED beside ALL) so it clears the info panel
  // above it rather than stacking up into it.
  const drawer = el(
    'div',
    [
      'position:fixed',
      'bottom:64px',
      'right:16px',
      'z-index:21',
      'max-width:calc(100vw - 32px)',
      'box-sizing:border-box',
      'padding:12px 14px',
      'gap:18px',
      'align-items:flex-start',
      'background:#ffffff',
      'border:1px solid rgba(0,0,0,0.08)',
      'border-radius:14px',
      'box-shadow:0 10px 30px rgba(0,0,0,0.18)',
      'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif',
      'display:none',
    ].join(';'),
  )
  document.body.append(drawer, button)

  const makeSection = (): { wrap: HTMLElement; head: HTMLElement; grid: HTMLElement } => {
    const wrap = el('div', 'display:flex;flex-direction:column')
    const head = el(
      'div',
      'font-size:11px;font-weight:600;letter-spacing:0.06em;color:#8a94a6;margin:0 0 8px',
    )
    const grid = el('div', 'display:flex;gap:8px')
    wrap.append(head, grid)
    return { wrap, head, grid }
  }
  const suggested = makeSection()
  const all = makeSection()
  const divider = el('div', 'align-self:stretch;width:1px;background:rgba(0,0,0,0.10)')
  drawer.append(suggested.wrap, divider, all.wrap)

  const empty = el('div', 'font-size:11px;color:#9aa3b2;max-width:104px;line-height:1.3')

  /** Builds a draggable card for a tool (dimmed when not usable). */
  const makeCard = (tool: Tool): HTMLElement => {
    const usable = tool.usable()
    const card = el(
      'div',
      [
        'width:84px',
        'box-sizing:border-box',
        'padding:7px',
        'background:#f5f7fa',
        'border:1px solid rgba(0,0,0,0.08)',
        'border-radius:10px',
        'text-align:center',
        `cursor:${usable ? 'grab' : 'default'}`,
        `opacity:${usable ? '1' : '0.45'}`,
        'user-select:none',
        'touch-action:none',
      ].join(';'),
    )
    const img = document.createElement('img')
    img.src = iconUrls[tool.id] ?? ''
    img.draggable = false
    img.style.cssText = 'display:block;width:100%;height:54px;object-fit:contain;pointer-events:none'
    const label = el(
      'div',
      'font-size:11px;font-weight:600;color:#374151;margin-top:3px;line-height:1.15',
    )
    label.textContent = t(tool.labelKey)
    card.append(img, label)
    if (usable) card.addEventListener('pointerdown', (e) => startDrag(tool, e))
    return card
  }

  const render = () => {
    button.textContent = `🧰 ${t('tool.inventory')}`
    suggested.head.textContent = t('tool.suggested')
    all.head.textContent = t('tool.all')

    suggested.grid.replaceChildren()
    const usable = tools.filter((tool) => tool.usable())
    if (usable.length) {
      for (const tool of usable) suggested.grid.appendChild(makeCard(tool))
    } else {
      empty.textContent = t('tool.empty')
      suggested.grid.appendChild(empty)
    }

    all.grid.replaceChildren()
    for (const tool of tools) all.grid.appendChild(makeCard(tool))
  }

  let isOpen = false
  const setOpen = (open: boolean) => {
    isOpen = open
    drawer.style.display = open ? 'flex' : 'none'
    if (open) render()
  }
  button.addEventListener('click', () => setOpen(!isOpen))
  onChange(() => {
    if (isOpen) render()
  })

  // Refresh the open drawer when tool availability changes (measuring step
  // begins, grille opens, filter swapped), so SUGGESTED stays honest.
  let lastSig = ''
  ctx.onFrame(() => {
    if (!isOpen) return
    const sig = tools.map((tool) => (tool.usable() ? '1' : '0')).join('')
    if (sig !== lastSig) {
      lastSig = sig
      render()
    }
  })

  // --- Drag and drop ---
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let dragging: Tool | null = null
  let ghost: HTMLImageElement | null = null
  let hoverTarget: THREE.Object3D | null = null

  const pickTarget = (e: PointerEvent): THREE.Object3D | null => {
    if (!dragging) return null
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1
    raycaster.setFromCamera(pointer, ctx.camera)

    const names = new Set(dragging.targetNodes)
    const objs: THREE.Object3D[] = []
    for (const name of names) {
      const obj = ctx.scene.getObjectByName(name)
      if (obj?.visible) objs.push(obj)
    }
    const hit = raycaster.intersectObjects(objs, true)[0]
    if (!hit) return null
    let obj: THREE.Object3D | null = hit.object
    while (obj && !names.has(obj.name)) obj = obj.parent
    return obj
  }

  const moveGhost = (e: PointerEvent) => {
    if (ghost) {
      ghost.style.left = `${e.clientX}px`
      ghost.style.top = `${e.clientY}px`
    }
  }

  const onDragMove = (e: PointerEvent) => {
    moveGhost(e)
    const target = pickTarget(e)
    hoverTarget = target && dragging?.usable() ? target : null
    ctx.outline(hoverTarget ? [hoverTarget] : []) // this runs after interactive's hover → wins
    if (ghost) ghost.style.opacity = hoverTarget ? '1' : '0.6'
  }

  const onDragEnd = (e: PointerEvent) => {
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
    document.body.style.userSelect = ''
    ghost?.remove()
    ghost = null
    ctx.outline([])
    const tool = dragging
    const target = pickTarget(e) // re-pick at the release point, not just the last move
    dragging = null
    hoverTarget = null
    if (tool && target && tool.usable()) {
      tool.apply()
      if (isOpen) render() // reflect the new availability at once
    }
  }

  const startDrag = (tool: Tool, e: PointerEvent) => {
    if (!tool.usable()) return
    e.preventDefault()
    document.body.style.userSelect = 'none' // no text selection while dragging out
    dragging = tool
    ghost = document.createElement('img')
    ghost.src = iconUrls[tool.id] ?? ''
    ghost.style.cssText = [
      'position:fixed',
      'width:80px',
      'height:80px',
      'object-fit:contain',
      'pointer-events:none',
      'z-index:100',
      'transform:translate(-50%,-50%)',
      'filter:drop-shadow(0 6px 10px rgba(0,0,0,0.35))',
    ].join(';')
    moveGhost(e)
    document.body.appendChild(ghost)
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }

  // --- Icon rendering (isolated per tool, transparent background) ---
  const renderIcon = (tool: Tool): string => {
    const source = ctx.scene.getObjectByName(tool.iconNode)
    if (!source) return ''

    const clone = source.clone(true)
    clone.position.set(0, 0, 0)
    clone.rotation.set(0, 0, 0)
    clone.scale.set(1, 1, 1)
    clone.traverse((o) => {
      o.visible = true
      if (tool.iconColor !== undefined && o instanceof THREE.Mesh) {
        const src = Array.isArray(o.material) ? o.material[0] : o.material
        const mat = src.clone() as THREE.Material & { color?: THREE.Color }
        mat.color?.setHex(tool.iconColor)
        o.material = mat
      }
    })

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(2, 3, 2.5)
    scene.add(key, clone)
    scene.updateMatrixWorld(true)

    const box = new THREE.Box3().setFromObject(clone)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z) || 1

    const cam = new THREE.PerspectiveCamera(35, 1, 0.01, 1000)
    const dir = new THREE.Vector3(0.7, 0.5, 1).normalize()
    cam.position.copy(center).addScaledVector(dir, maxDim * 2.6)
    cam.lookAt(center)

    const rt = new THREE.WebGLRenderTarget(ICON, ICON)
    rt.texture.colorSpace = THREE.SRGBColorSpace

    const prevClear = ctx.renderer.getClearColor(new THREE.Color())
    const prevAlpha = ctx.renderer.getClearAlpha()
    ctx.renderer.setClearColor(0x000000, 0) // transparent icon background
    ctx.renderer.setRenderTarget(rt)
    ctx.renderer.clear()
    ctx.renderer.render(scene, cam)
    ctx.renderer.setRenderTarget(null)
    ctx.renderer.setClearColor(prevClear, prevAlpha)

    const buf = new Uint8Array(ICON * ICON * 4)
    ctx.renderer.readRenderTargetPixels(rt, 0, 0, ICON, ICON, buf)
    rt.dispose()
    return toDataURL(buf)
  }

  const syncModel = () => {
    for (const tool of tools) iconUrls[tool.id] = renderIcon(tool)
    if (isOpen) render()
  }

  render() // button label + (hidden) drawer, before icons exist
  return { syncModel }
}

/** Turns a bottom-up RGBA buffer (WebGL order) into a top-down PNG data URL. */
function toDataURL(buf: Uint8Array): string {
  const canvas = document.createElement('canvas')
  canvas.width = ICON
  canvas.height = ICON
  const c = canvas.getContext('2d')!
  const image = c.createImageData(ICON, ICON)
  const rowBytes = ICON * 4
  for (let y = 0; y < ICON; y++) {
    const src = (ICON - 1 - y) * rowBytes // flip vertically into canvas order
    image.data.set(buf.subarray(src, src + rowBytes), y * rowBytes)
  }
  c.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
