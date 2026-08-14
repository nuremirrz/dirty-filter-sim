import {
  activeCameraPreset,
  type AirflowVisual,
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
//
// Re-aimed for House_final.glb. The registers kept their size and their 2.84
// ceiling height, so each station keeps the framing it had: the camera offsets
// relative to the object each one looks at are the old ones, applied to the new
// positions. Only the wide shot needed fresh numbers — the house is deep now
// (7.7 across Z, was 4.85), not the near-flat slab the old one was.
export const CAMERAS: CameraPreset[] = [
  {
    name: 'system_overview',
    position: { x: 7, y: 6.5, z: -19 },
    target: { x: 3.4, y: 1.4, z: 0.7 },
  },
  {
    name: 'supply_air',
    position: { x: 7.27, y: 1.43, z: -1.07 },
    target: { x: 6.82, y: 2.84, z: 0.72 },
  },
  {
    // Offset from the grille rather than straight under it. Dead underneath is
    // the prettier shot, but the filter sits recessed above the ceiling: from
    // there the opening's edge hides all but a sliver of it, and the player has
    // to hunt for somewhere to click. Standing off to -X opens the recess up.
    name: 'return_air',
    position: { x: 4.0, y: 0.9, z: -1.6 },
    target: { x: 5.29, y: 2.84, z: 0.72 },
  },
]

// Stations you can look closer at — everything except the wide overview.
export const INSPECTABLE = ['supply_air', 'return_air']

/**
 * Props that ship in the shared house model but belong to another level's
 * problem. The closet is Problem 2's blockage; it stands right beside the
 * return, so here it only crowds the view of the grille the player has to
 * open. Hidden rather than cut from the GLB, which the other levels still need.
 */
const FOREIGN_PROPS = ['closet']

/** Hides the other levels' props. Call once the model has loaded. */
export function hideForeignProps(ctx: SceneContext): void {
  for (const name of FOREIGN_PROPS) {
    const obj = ctx.scene.getObjectByName(name)
    if (obj) obj.visible = false
  }
}

/**
 * Airflow at the supply, in m/s: a dirty filter chokes it, a clean one restores
 * it. One source of truth for both the device's reading and the visible stream.
 */
const FLOW_HEALTHY = 2.5
const FLOW_CHOKED = 0.7

export function createFlow(filter: FilterApi): () => number {
  return () => (filter.isReplaced() ? FLOW_HEALTHY : FLOW_CHOKED)
}

/** The one visible stream on this level, off the same flow. */
export function createAirflowConfig(flow: () => number): AirflowVisual[] {
  return [{ objectName: 'supply_bedroom1', flow }]
}

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
    objectName: 'supply_bedroom1',
    labelKey: 'label.supply',
    activeOnStates: ['measure_low', 'measure_ok'],
  },
  {
    objectName: 'return_grille',
    labelKey: 'label.return',
    activeOnStates: ['locate_grille', 'open_grille', 'close_grille'],
  },
  { objectName: 'cap_2', labelKey: 'label.filter', activeOnStates: ['replace_filter'] },
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
 * The flow advances from the world alone: `isDone` closes over the level's own
 * props and the poll picks up whatever the player did — a click on the object, a
 * tool dragged onto it, a jump via the camera strip. No step hands out a button
 * that performs its goal, so the hint says what to look for and finding it is
 * the player's job.
 *
 * The measuring steps are the exception, and not by choice: a reading has to be
 * read before the flow moves off it, so the engine keeps a "continue" button on
 * screen for as long as one is displayed. `measure_low` still needs `onAction`
 * for that press — it is where the skip-ahead branch lives.
 */
export function createStateConfig(
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
        // Getting to the supply is the step: click the register or take the
        // camera strip there.
        isDone: () => activeCameraPreset() === 'supply_air',
      },
      measure_low: {
        hintKey: 'state.measure_low.hint',
        cameraPreset: 'supply_air',
        measuring: true,
        // If the airflow already reads healthy, the filter was fixed before
        // diagnosing — the problem is solved, so skip straight to the finish.
        onAction: (flow) => (filter.isReplaced() ? flow.jumpTo('complete') : flow.advance()),
      },
      locate_grille: {
        hintKey: 'state.locate_grille.hint',
        isDone: () => activeCameraPreset() === 'return_air',
      },
      open_grille: {
        hintKey: 'state.open_grille.hint',
        cameraPreset: 'return_air',
        isDone: () => grille.isOpen(),
      },
      replace_filter: {
        hintKey: 'state.replace_filter.hint',
        isDone: () => filter.isReplaced(),
      },
      close_grille: {
        hintKey: 'state.close_grille.hint',
        isDone: () => grille.isClosed(),
      },
      measure_ok: {
        hintKey: 'state.measure_ok.hint',
        cameraPreset: 'supply_air',
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
      targetNodes: ['supply_bedroom1', 'anemometer'],
      usable: () => hud.canTakeReading(),
      apply: () => hud.takeReading(),
    },
    {
      id: 'filter',
      labelKey: 'tool.clean_filter',
      iconNode: 'cap_2',
      iconColor: 0xf0f0f0, // show it as the clean spare
      targetNodes: ['cap_2'],
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
    { objectName: 'supply_bedroom1', preset: 'supply_air' },
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
    { objectName: 'cap_2', preset: 'return_air', act: () => filter.replace() },
  ]
}
