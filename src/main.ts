import {
  applyStartCamera,
  createBreadcrumbs,
  createCameraStrip,
  createHints,
  createHud,
  createInspect,
  createInteractions,
  createInventory,
  createResultOverlay,
  createScene,
  getInitialLang,
  getLang,
  initCameraMotion,
  initLocaleBridge,
  loadModel,
  onChange,
  registerDictionary,
  setLang,
  t,
} from '@hvac/engine'
import { createGrille } from './grille'
import { createFilter } from './filter'
import { dict } from './dictionary'
import {
  CAMERAS,
  INSPECTABLE,
  LABELS,
  TASKS,
  createClickTargets,
  createStateConfig,
  createTools,
  type GameState,
  type TaskProgress,
} from './level'

const container = document.getElementById('app')
if (!container) {
  throw new Error('Missing #app container in index.html')
}

// Dictionary first of all: the engine ships no strings, and registering does not
// re-render what is already on screen — so nothing may call t() before this.
registerDictionary(dict)

// Locale next, before anything renders: ?lang=… sets the initial locale, and a
// trusted embedding parent can switch it live over postMessage.
setLang(getInitialLang())
initLocaleBridge()

// Keep the tab title and <html lang> in sync with the active locale.
const applyDocumentMeta = () => {
  document.title = t('ui.docTitle')
  document.documentElement.lang = getLang()
}
applyDocumentMeta()
onChange(applyDocumentMeta)

// Boot the scene, start on the overview camera (before the first frame), mount
// the gameplay HUD, then load the model.
const ctx = createScene(container, { cameras: CAMERAS, inspectable: INSPECTABLE })
initCameraMotion(ctx)
applyStartCamera(ctx)
// Bottom camera strip: thumbnail per preset (stills captured after the load).
const cameraStrip = createCameraStrip(ctx)
// "Look closer" inspect view + top-center breadcrumbs that reflect the location.
const inspect = createInspect(ctx)
createBreadcrumbs(ctx, inspect)
// Shared props: the scripted buttons and direct clicks drive the same objects.
const grille = createGrille(ctx)
// The filter sits behind the grille, so it cannot be swapped until it is aside.
const filter = createFilter(ctx, () => grille.isOpen())
// The flow's isDone/onAction close over the props, so it is built after them.
const states = createStateConfig(ctx, grille, filter)
// 3D labels + active-object highlight, driven by the HUD's state changes.
const hints = createHints(ctx, LABELS)
// Level-complete result card (shown on the final state; Restart reloads).
const overlay = createResultOverlay()
const hud = createHud<GameState, TaskProgress>(ctx, {
  states,
  tasks: TASKS,
  reading: () => (filter.isReplaced() ? 2.5 : 0.7),
  progress: (base) => ({ ...base, filterReplaced: filter.isReplaced() }),
  slug: 'dirty-filter',
  hints,
  overlay,
})
createInteractions(ctx, { clickTargets: createClickTargets(grille, filter, hud) })
// Inventory drawer: drag a tool (anemometer / clean filter) onto its object.
const inventory = createInventory(ctx, { tools: createTools(grille, filter, hud) })
loadModel(ctx, () => {
  hud.syncModel()
  cameraStrip.capture() // snapshot each preset now the model is in the scene
  inventory.syncModel() // render tool icons from the model
})
