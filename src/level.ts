import {
  activeCameraPreset,
  flyToCameraPresetByName,
  type CameraPreset,
  type ClickTarget,
  type HudProgressBase,
  type LabelConfig,
  type SceneContext,
  type StateConfig,
  type TaskConfig,
  type Tool,
  type ReadingTaker,
} from '@hvac/engine'
import type { GrilleApi } from './grille'
import type { FilterApi } from './filter'

// Fixed inspection viewpoints, named for the HVAC stage each one frames. The
// coordinates belong to this level's model; the first is the starting camera.
export const CAMERAS: CameraPreset[] = [
  {
    name: 'system_overview',
    position: { x: 6.29, y: 1.6, z: -12.54 },
    target: { x: 1.13, y: 2.98, z: 0.82 },
  },
  {
    name: 'supply_air',
    position: { x: 4.62, y: 1.43, z: -1.08 },
    target: { x: 4.17, y: 2.84, z: 0.71 },
  },
  {
    name: 'return_air',
    position: { x: 2.05, y: 0.19, z: -0.34 },
    target: { x: 2.05, y: 2.84, z: 0.71 },
  },
]

// Stations you can look closer at — everything except the wide overview.
export const INSPECTABLE = ['supply_air', 'return_air']

export type GameState =
  | 'overview'
  | 'measure_low'
  | 'locate_grille'
  | 'open_grille'
  | 'replace_filter'
  | 'close_grille'
  | 'measure_ok'
  | 'complete'

/** What the player has actually done, independent of where the guided flow sits. */
export interface TaskProgress extends HudProgressBase {
  filterReplaced: boolean
}

// GLB object each label rides on, its i18n key, and the steps it lights up on.
export const LABELS: LabelConfig[] = [
  {
    objectName: 'supply_duct',
    labelKey: 'label.supply',
    activeOnStates: ['measure_low', 'measure_ok'],
  },
  {
    objectName: 'return_grille',
    labelKey: 'label.return',
    activeOnStates: ['locate_grille', 'open_grille', 'close_grille'],
  },
  { objectName: 'filter', labelKey: 'label.filter', activeOnStates: ['replace_filter'] },
]

// The checklist is keyed to real accomplishments, not the flow's position, so a
// task done out of order — e.g. replacing the filter before the first reading —
// still ticks the moment it actually happens.
export const TASKS: TaskConfig<TaskProgress>[] = [
  { taskKey: 'task.check_supply', done: (p) => p.supplyMeasured },
  { taskKey: 'task.replace_filter', done: (p) => p.filterReplaced },
  { taskKey: 'task.remeasure', done: (p) => p.airflowRechecked },
]

/**
 * Ordered flow for Problem 1 (dirty filter).
 *
 * Each `onAction` closes over the level's own props, changes the world and then
 * moves the flow on itself — the engine never sees a grille or a filter.
 * `isDone` covers the other route: a direct click on the object in the scene
 * changes the same world, and the poll picks it up.
 */
export function createStateConfig(
  ctx: SceneContext,
  grille: GrilleApi,
  filter: FilterApi,
): StateConfig<GameState> {
  return {
    order: [
      'overview',
      'measure_low',
      'locate_grille',
      'open_grille',
      'replace_filter',
      'close_grille',
      'measure_ok',
      'complete',
    ],
    data: {
      overview: {
        hintKey: 'state.overview.hint',
        cameraPreset: 'system_overview',
        btnKey: 'state.overview.btn',
        isDone: () => activeCameraPreset() === 'supply_air',
        onAction: (flow) => {
          flyToCameraPresetByName(ctx, 'supply_air')
          flow.advance()
        },
      },
      measure_low: {
        hintKey: 'state.measure_low.hint',
        cameraPreset: 'supply_air',
        btnKey: 'state.measure.btn',
        measuring: true,
        // If the airflow already reads healthy, the filter was fixed before
        // diagnosing — the problem is solved, so skip straight to the finish.
        onAction: (flow) => (filter.isReplaced() ? flow.jumpTo('complete') : flow.advance()),
      },
      locate_grille: {
        hintKey: 'state.locate_grille.hint',
        btnKey: 'state.locate_grille.btn',
        isDone: () => activeCameraPreset() === 'return_air',
        onAction: (flow) => {
          flyToCameraPresetByName(ctx, 'return_air')
          flow.advance()
        },
      },
      open_grille: {
        hintKey: 'state.open_grille.hint',
        cameraPreset: 'return_air',
        btnKey: 'state.open_grille.btn',
        isDone: () => grille.isOpen(),
        onAction: (flow) => {
          grille.open()
          flow.advance()
        },
      },
      replace_filter: {
        hintKey: 'state.replace_filter.hint',
        btnKey: 'state.replace_filter.btn',
        isDone: () => filter.isReplaced(),
        onAction: (flow) => {
          filter.replace()
          flow.advance()
        },
      },
      close_grille: {
        hintKey: 'state.close_grille.hint',
        btnKey: 'state.close_grille.btn',
        isDone: () => grille.isClosed(),
        onAction: (flow) => {
          grille.close()
          flow.advance()
        },
      },
      measure_ok: {
        // Shares the button key with measure_low — one "Measure" label, no dupe.
        hintKey: 'state.measure_ok.hint',
        cameraPreset: 'supply_air',
        btnKey: 'state.measure.btn',
        measuring: true,
        // Just moves on; the level completes on the next state.
      },
      complete: {
        hintKey: 'state.complete.hint',
      },
    },
    // Healthy band, in m/s. What the device actually reads is HudConfig.reading:
    // a dirty filter chokes the flow (0.7), a clean one restores it (2.5).
    airflow: { normMin: 2, normMax: 3.5 },
  }
}

/** Tools in the inventory drawer; dragging one onto its object applies it. */
export function createTools(grille: GrilleApi, filter: FilterApi, hud: ReadingTaker): Tool[] {
  return [
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
}

/** Clickable objects: a click travels to them, then acts once already framed. */
export function createClickTargets(
  grille: GrilleApi,
  filter: FilterApi,
  hud: ReadingTaker,
): ClickTarget[] {
  return [
    { objectName: 'supply_duct', preset: 'supply_air' },
    // The device only exists while measuring, and the step already parks the
    // camera on it — so a click is always its own button, never a trip.
    {
      objectName: 'anemometer',
      preset: 'supply_air',
      act: () => hud.takeReading(),
      canAct: () => hud.canTakeReading(),
    },
    { objectName: 'return_grille', preset: 'return_air', act: () => grille.toggle() },
    // The filter sits right behind the grille, so the return camera frames it
    // already — that is its station, and a click from anywhere else travels
    // there. While the grille is shut it also blocks the ray, so the filter
    // cannot be reached through a closed grille without any explicit check.
    { objectName: 'filter', preset: 'return_air', act: () => filter.replace() },
  ]
}
