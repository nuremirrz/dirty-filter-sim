import type { SceneContext } from './scene'
import { activeCameraPreset, flyToCameraPresetByName } from './cameras'
import type { InspectApi } from './inspect'
import { t, onChange } from './i18n'

interface Crumb {
  label: string
  onClick: (() => void) | null // null = current location, not a link
}

/**
 * Top-center breadcrumb bar showing the camera's location (Overview › Station ›
 * Inspect). Earlier crumbs are clickable to fly back there. On the right sits
 * the inspect toggle: "🔍 Inspect" at a station, "Back to camera (Esc)" while
 * inspecting.
 */
export function createBreadcrumbs(ctx: SceneContext, inspect: InspectApi): void {
  const bar = document.createElement('div')
  bar.style.cssText = [
    'position:fixed',
    'top:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:20',
    'display:flex',
    'align-items:center',
    'gap:14px',
    'padding:8px 14px',
    'background:#ffffff',
    'border:1px solid rgba(0,0,0,0.08)',
    'border-radius:10px',
    'box-shadow:0 6px 20px rgba(0,0,0,0.14)',
    'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif',
    'font-size:13px',
    'max-width:calc(100vw - 32px)',
  ].join(';')

  const trail = document.createElement('div')
  trail.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap'

  const toggle = document.createElement('button')
  toggle.style.cssText = [
    'padding:5px 12px',
    'font:inherit',
    'font-weight:600',
    'border-radius:8px',
    'border:1px solid rgba(47,109,246,0.35)',
    'background:#eef3ff',
    'color:#2f6df6',
    'cursor:pointer',
    'white-space:nowrap',
  ].join(';')
  toggle.addEventListener('click', () => {
    if (inspect.isInspecting()) inspect.exit()
    else inspect.enter()
  })

  bar.append(trail, toggle)
  document.body.appendChild(bar)

  const crumbs = (): Crumb[] => {
    const active = activeCameraPreset()
    const inspecting = inspect.isInspecting()
    const list: Crumb[] = []

    // Root is always the overview; it's a link unless we're already there.
    const atOverview = active === 'system_overview' && !inspecting
    list.push({
      label: t('camera.system_overview'),
      onClick: atOverview ? null : () => flyToCameraPresetByName(ctx, 'system_overview'),
    })

    // The station crumb, when the camera is at one (not the overview).
    if (active && active !== 'system_overview') {
      const name = active
      list.push({
        label: t(`camera.${name}`),
        onClick: inspecting ? () => flyToCameraPresetByName(ctx, name) : null,
      })
    }

    // The closer-look crumb, when inspecting.
    if (inspecting) list.push({ label: t('ui.inspect'), onClick: null })

    return list
  }

  const render = () => {
    trail.replaceChildren()
    crumbs().forEach((crumb, i) => {
      if (i > 0) {
        const sep = document.createElement('span')
        sep.textContent = '›'
        sep.style.cssText = 'margin:0 8px;color:#c2c8d2'
        trail.appendChild(sep)
      }
      const node = document.createElement(crumb.onClick ? 'button' : 'span')
      node.textContent = crumb.label
      if (crumb.onClick) {
        node.style.cssText =
          'font:inherit;padding:0;border:none;background:none;color:#2f6df6;cursor:pointer'
        node.addEventListener('click', crumb.onClick)
      } else {
        node.style.cssText = 'font-weight:600;color:#1f2430' // current location
      }
      trail.appendChild(node)
    })

    // The toggle: hidden at the overview, "Inspect" at a station, "Back" inside.
    if (inspect.isInspecting()) {
      toggle.textContent = `← ${t('ui.back_to_camera')}`
      toggle.style.display = ''
    } else if (inspect.inspectable()) {
      toggle.textContent = `🔍 ${t('ui.inspect')}`
      toggle.style.display = ''
    } else {
      toggle.style.display = 'none'
    }
  }

  render()
  onChange(render) // re-label on locale change
  inspect.onChange(render) // re-render when inspect enters/exits

  // The active preset changes from the flow / strip / crumbs without notifying
  // us, so poll it and re-render only when the location actually changes.
  let shown = ''
  ctx.onFrame(() => {
    const key = `${activeCameraPreset()}|${inspect.isInspecting()}`
    if (key !== shown) {
      shown = key
      render()
    }
  })
}
