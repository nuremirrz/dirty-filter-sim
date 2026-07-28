import { createScene } from './scene'
import { loadModel } from './loader'
import { applyStartCamera, initCameraMotion } from './cameras'
import { createCameraStrip } from './camerastrip'
import { createInspect } from './inspect'
import { createBreadcrumbs } from './breadcrumbs'
import { createInventory } from './inventory'
import { createHud } from './hud'
import { createInteractions } from './interactive'
import { createGrille } from './grille'
import { createFilter } from './filter'
import { createHints } from './labels'
import { createResultOverlay } from './overlay'
import { setLang, getInitialLang, initLocaleBridge, onChange, getLang, t } from './i18n'

const container = document.getElementById('app')
if (!container) {
  throw new Error('Missing #app container in index.html')
}

// Locale first, before anything renders: ?lang=… sets the initial locale, and a
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
const ctx = createScene(container)
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
// 3D labels + active-object highlight, driven by the HUD's state changes.
const hints = createHints(ctx)
// Level-complete result card (shown on the final state; Restart reloads).
const overlay = createResultOverlay()
const hud = createHud(ctx, grille, filter, hints, overlay)
createInteractions(ctx, grille, filter, hud)
// Inventory drawer: drag a tool (anemometer / clean filter) onto its object.
const inventory = createInventory(ctx, grille, filter, hud)
loadModel(ctx, () => {
  hud.syncModel()
  cameraStrip.capture() // snapshot each preset now the model is in the scene
  inventory.syncModel() // render tool icons from the model
})
