export type GameState =
  | 'overview'
  | 'measure_low'
  | 'locate_grille'
  | 'open_grille'
  | 'replace_filter'
  | 'close_grille'
  | 'measure_ok'
  | 'complete'

export interface StateData {
  /** i18n key for the HUD hint; resolved by t() at render time, not baked in. */
  hintKey: string
  cameraPreset?: string
  /** i18n key for the action button; absent means the state has no button. */
  btnKey?: string
}

// Ordered flow for Problem 1 (dirty filter).
export const STATE_ORDER: GameState[] = [
  'overview',
  'measure_low',
  'locate_grille',
  'open_grille',
  'replace_filter',
  'close_grille',
  'measure_ok',
  'complete',
]

export const STATE_DATA: Record<GameState, StateData> = {
  overview: {
    hintKey: 'state.overview.hint',
    cameraPreset: 'system_overview',
    btnKey: 'state.overview.btn',
  },
  measure_low: {
    hintKey: 'state.measure_low.hint',
    cameraPreset: 'supply_air',
    btnKey: 'state.measure.btn',
  },
  locate_grille: {
    hintKey: 'state.locate_grille.hint',
    btnKey: 'state.locate_grille.btn',
  },
  open_grille: {
    hintKey: 'state.open_grille.hint',
    cameraPreset: 'return_air',
    btnKey: 'state.open_grille.btn',
  },
  replace_filter: {
    hintKey: 'state.replace_filter.hint',
    btnKey: 'state.replace_filter.btn',
  },
  close_grille: {
    hintKey: 'state.close_grille.hint',
    btnKey: 'state.close_grille.btn',
  },
  measure_ok: {
    // Shares the button key with measure_low — one "Measure" label, no dupe.
    hintKey: 'state.measure_ok.hint',
    cameraPreset: 'supply_air',
    btnKey: 'state.measure.btn',
  },
  complete: {
    hintKey: 'state.complete.hint',
  },
}

// Airflow the anemometer reads, in m/s. States absent from this map are not
// measuring — the device is hidden there. Drives both the HUD readout and the
// impeller spin speed, so the number lives in exactly one place.
export const AIRFLOW_READINGS: Partial<Record<GameState, number>> = {
  measure_low: 0.7,
  measure_ok: 2.5,
}

/** Healthy airflow range, in m/s — shown as the "Норма" hint under the readout. */
export const AIRFLOW_NORM_MIN = 2
export const AIRFLOW_NORM_MAX = 3.5

/** Linear state machine over STATE_ORDER; advance() steps to the next state. */
export class StateMachine {
  private index = 0

  constructor(
    private readonly onChange: (state: GameState, data: StateData) => void,
  ) {}

  get state(): GameState {
    return STATE_ORDER[this.index]
  }

  get data(): StateData {
    return STATE_DATA[this.state]
  }

  /** Fires the current (initial) state to the listener. Call once after setup. */
  start(): void {
    this.onChange(this.state, this.data)
  }

  /** Advances to the next state (no-op at the final state). */
  advance(): void {
    if (this.index < STATE_ORDER.length - 1) {
      this.index += 1
      this.onChange(this.state, this.data)
    }
  }
}
