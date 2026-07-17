import type { SceneContext } from './scene'
import {
  StateMachine,
  STATE_ORDER,
  AIRFLOW_READINGS,
  AIRFLOW_NORM_MIN,
  AIRFLOW_NORM_MAX,
  type GameState,
  type StateData,
} from './state'
import { flyToCameraPresetByName, activeCameraPreset } from './cameras'
import { createAnemometer } from './anemometer'
import type { GrilleApi } from './grille'
import type { FilterApi } from './filter'
import { t, onChange } from './i18n'

const TOTAL_STEPS = STATE_ORDER.length - 1 // overview is setup, not a numbered step

/** Formats a taken reading for the HUD block. */
function anemometerReadout(reading: number): { value: string; color: string } {
  const withinNorm = reading >= AIRFLOW_NORM_MIN && reading <= AIRFLOW_NORM_MAX
  return {
    value: t('hud.airflow', { value: reading }),
    color: withinNorm ? '#4caf50' : '#f44336', // green when healthy, red when low
  }
}

export interface HudApi {
  /** Re-applies model-dependent state; call once the GLB has finished loading. */
  syncModel: () => void
  /** Takes the reading, as pressing the device's own button would. */
  takeReading: () => void
  /** True while a reading is waiting to be taken on this step. */
  canTakeReading: () => boolean
}

/**
 * Builds the gameplay HUD (progress + hint + anemometer + action button) and
 * drives the Problem 1 state machine. Camera cuts and the level-complete
 * postMessage fire on the relevant state entries.
 */
export function createHud(ctx: SceneContext, grille: GrilleApi, filter: FilterApi): HudApi {
  // --- Top-center: progress + hint + anemometer ---
  const topPanel = document.createElement('div')
  topPanel.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:20',
    'width:min(520px,90vw)',
    'box-sizing:border-box',
    'display:flex',
    'flex-direction:column',
    'align-items:center',
    'gap:8px',
    'padding:12px 16px',
    'background:rgba(0,0,0,0.72)',
    'border-radius:10px',
    'color:#fff',
    'text-align:center',
    'font-family:system-ui,-apple-system,sans-serif',
  ].join(';')

  const progress = document.createElement('div')
  progress.id = 'hud-progress'
  progress.style.cssText = 'font-size:12px;color:#bbb'

  const hint = document.createElement('div')
  hint.id = 'hud-hint'
  hint.style.cssText = 'font-size:16px;line-height:1.4'

  const anemo = document.createElement('div')
  anemo.id = 'hud-anemo'
  anemo.style.cssText = 'display:none;flex-direction:column;gap:2px;margin-top:2px'
  const anemoValue = document.createElement('div')
  anemoValue.id = 'hud-anemo-value'
  anemoValue.style.cssText = 'font-size:28px;font-weight:500'
  const anemoNorm = document.createElement('div')
  anemoNorm.style.cssText = 'font-size:12px;color:#bbb' // text set in paint() (locale-aware)
  anemo.append(anemoValue, anemoNorm)

  topPanel.append(progress, hint, anemo)

  // --- Bottom-center: action button ---
  const actionBtn = document.createElement('button')
  actionBtn.id = 'hud-action'
  actionBtn.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:20',
    'padding:12px 24px',
    'font-size:15px',
    'font-family:inherit',
    'background:#2196f3',
    'color:#fff',
    'border:none',
    'border-radius:8px',
    'cursor:pointer',
  ].join(';')

  document.body.append(topPanel, actionBtn)

  // --- State machine wiring ---
  const anemometer = createAnemometer(ctx)

  // On a measuring step the reading is not handed over on arrival: the player
  // has to press "Замерить" first, and only the press after that moves on.
  let measured = false

  const paint = (state: GameState, data: StateData) => {
    const step = STATE_ORDER.indexOf(state)
    progress.textContent =
      state === 'overview' ? t('hud.overview') : t('hud.step', { n: step, total: TOTAL_STEPS })
    hint.textContent = t(data.hintKey)
    anemoNorm.textContent = t('hud.norm', { min: AIRFLOW_NORM_MIN, max: AIRFLOW_NORM_MAX })

    const airflow = AIRFLOW_READINGS[state]
    const revealed = measured ? airflow : undefined
    const readout = revealed === undefined ? null : anemometerReadout(revealed)
    if (readout) {
      anemoValue.textContent = readout.value
      anemoValue.style.color = readout.color
      anemo.style.display = 'flex'
    } else {
      anemo.style.display = 'none'
    }

    // Once the reading is on screen, the button's job changes to "move on".
    const label =
      airflow !== undefined && measured
        ? t('hud.continue')
        : data.btnKey
          ? t(data.btnKey)
          : undefined
    if (label) {
      actionBtn.textContent = label
      actionBtn.style.display = 'block'
    } else {
      actionBtn.style.display = 'none'
    }

    anemometer.setState(state, revealed)
  }

  const machine = new StateMachine((state, data) => {
    measured = false
    paint(state, data)

    if (data.cameraPreset) flyToCameraPresetByName(ctx, data.cameraPreset)

    if (state === 'complete') notifyParentComplete()
  })

  // A step is done when the world says so, not when a button was pressed. Both
  // the button and a direct click on the object only touch the world, so the two
  // routes cannot disagree — and a goal that is already met is simply skipped.
  const objectives: Partial<Record<GameState, () => boolean>> = {
    overview: () => activeCameraPreset() === 'supply_air',
    locate_grille: () => activeCameraPreset() === 'return_air',
    open_grille: () => grille.isOpen(),
    replace_filter: () => filter.isReplaced(),
    close_grille: () => grille.isClosed(),
  }

  ctx.onFrame(() => {
    if (objectives[machine.state]?.()) machine.advance()
  })

  // Taking the reading is one action with two triggers — this button and a click
  // on the device itself — so they cannot drift apart.
  const canTakeReading = () => AIRFLOW_READINGS[machine.state] !== undefined && !measured
  const takeReading = () => {
    if (!canTakeReading()) return
    measured = true
    paint(machine.state, machine.data)
  }

  actionBtn.addEventListener('click', () => {
    // First press on a measuring step takes the reading and stays put.
    if (canTakeReading()) {
      takeReading()
      return
    }
    // The button is a shortcut for the same world change a click would make; the
    // objective above is what actually moves the flow on.
    switch (machine.state) {
      case 'overview':
        flyToCameraPresetByName(ctx, 'supply_air')
        break
      case 'locate_grille':
        flyToCameraPresetByName(ctx, 'return_air')
        break
      case 'open_grille':
        grille.open()
        break
      case 'replace_filter':
        filter.replace()
        break
      case 'close_grille':
        grille.close()
        break
      // Measuring steps have no object to act on, so "Далее" moves on directly.
      default:
        machine.advance()
    }
  })
  machine.start()

  // Re-render on locale change: paint() re-reads every string through t(), and
  // repaints the LCD via anemometer.setState — so nothing stays "baked in".
  onChange(() => paint(machine.state, machine.data))

  return {
    syncModel: () => paint(machine.state, machine.data),
    takeReading,
    canTakeReading,
  }
}

/** Notifies the embedding platform (iframe host) that the level is done. */
function notifyParentComplete(): void {
  if (window.parent === window) {
    console.log('🏁 complete (top-level: postMessage skipped, not embedded)')
    return
  }
  window.parent.postMessage(
    { source: 'hvac-sim', type: 'level-complete', slug: 'dirty-filter' },
    '*',
  )
  console.log('🏁 complete → postMessage sent to parent')
}
