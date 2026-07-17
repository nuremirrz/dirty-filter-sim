export const SUPPORTED = ['en', 'ru', 'es'] as const
export type Lang = (typeof SUPPORTED)[number]
export const DEFAULT: Lang = 'en'

/** Params passed to template-style dictionary values. */
export type TParams = Record<string, string | number>
type Entry = string | ((p: TParams) => string)

/** Coerces any input to a supported locale, falling back to DEFAULT. */
export function normalize(l: string | null | undefined): Lang {
  return (SUPPORTED as readonly string[]).includes(l ?? '') ? (l as Lang) : DEFAULT
}

// Flat dotted keys. Values are plain strings, or functions for templates with
// substitutions. supply/return terms ("подача"/"возврат") are ordinary values
// here so they can be reworded later without touching code.
const dict: Record<Lang, Record<string, Entry>> = {
  en: {
    'state.overview.hint': 'Look around. Start by checking the air supply.',
    'state.overview.btn': 'Check the supply',
    'state.measure_low.hint': 'Measure the airflow at the supply.',
    'state.measure.btn': 'Measure',
    'state.locate_grille.hint': 'Airflow is weak. Check the return — go to the grille.',
    'state.locate_grille.btn': 'Go to the return',
    'state.open_grille.hint': 'Open the return grille.',
    'state.open_grille.btn': 'Open the grille',
    'state.replace_filter.hint': 'The filter is dirty. Replace it.',
    'state.replace_filter.btn': 'Replace the filter',
    'state.close_grille.hint': 'Close the grille.',
    'state.close_grille.btn': 'Close the grille',
    'state.measure_ok.hint': 'Measure the airflow again.',
    'state.complete.hint': 'Great! Airflow is back to normal. Problem solved.',
    'hud.continue': 'Continue',
    'hud.overview': 'Overview',
    'hud.step': (p: TParams) => `Step ${p.n} of ${p.total}`,
    'hud.airflow': (p: TParams) => `${p.value} m/s`,
    'hud.norm': (p: TParams) => `Normal: ${p.min}–${p.max}`,
    'anem.unit': 'm/s',
    'ui.docTitle': 'Dirty Filter Simulation',
  },
  ru: {
    'state.overview.hint': 'Осмотритесь. Начните с проверки подачи воздуха.',
    'state.overview.btn': 'Проверить подачу',
    'state.measure_low.hint': 'Замерьте поток воздуха у подачи.',
    'state.measure.btn': 'Замерить',
    'state.locate_grille.hint': 'Поток слабый. Проверьте возврат — перейдите к решётке.',
    'state.locate_grille.btn': 'Перейти к возврату',
    'state.open_grille.hint': 'Откройте решётку возврата.',
    'state.open_grille.btn': 'Открыть решётку',
    'state.replace_filter.hint': 'Фильтр грязный. Замените его.',
    'state.replace_filter.btn': 'Заменить фильтр',
    'state.close_grille.hint': 'Закройте решётку.',
    'state.close_grille.btn': 'Закрыть решётку',
    'state.measure_ok.hint': 'Замерьте поток снова.',
    'state.complete.hint': 'Отлично! Поток в норме. Проблема решена.',
    'hud.continue': 'Далее',
    'hud.overview': 'Обзор',
    'hud.step': (p: TParams) => `Шаг ${p.n} из ${p.total}`,
    'hud.airflow': (p: TParams) => `${p.value} м/с`,
    'hud.norm': (p: TParams) => `Норма: ${p.min}–${p.max}`,
    'anem.unit': 'м/с',
    'ui.docTitle': 'Симуляция: грязный фильтр',
  },
  es: {
    'state.overview.hint': 'Observa el entorno. Empieza revisando el suministro de aire.',
    'state.overview.btn': 'Revisar el suministro',
    'state.measure_low.hint': 'Mide el flujo de aire en el suministro.',
    'state.measure.btn': 'Medir',
    'state.locate_grille.hint': 'El flujo es débil. Revisa el retorno: ve a la rejilla.',
    'state.locate_grille.btn': 'Ir al retorno',
    'state.open_grille.hint': 'Abre la rejilla de retorno.',
    'state.open_grille.btn': 'Abrir la rejilla',
    'state.replace_filter.hint': 'El filtro está sucio. Reemplázalo.',
    'state.replace_filter.btn': 'Reemplazar el filtro',
    'state.close_grille.hint': 'Cierra la rejilla.',
    'state.close_grille.btn': 'Cerrar la rejilla',
    'state.measure_ok.hint': 'Mide el flujo de aire de nuevo.',
    'state.complete.hint': '¡Genial! El flujo volvió a la normalidad. Problema resuelto.',
    'hud.continue': 'Continuar',
    'hud.overview': 'Vista general',
    'hud.step': (p: TParams) => `Paso ${p.n} de ${p.total}`,
    'hud.airflow': (p: TParams) => `${p.value} m/s`,
    'hud.norm': (p: TParams) => `Normal: ${p.min}–${p.max}`,
    'anem.unit': 'm/s',
    'ui.docTitle': 'Simulación: filtro sucio',
  },
}

let current: Lang = DEFAULT
const listeners = new Set<() => void>()

/** The active locale. */
export function getLang(): Lang {
  return current
}

/**
 * Translates a key, filling a template value with params. Falls back
 * current → DEFAULT → the key itself, so a missing key is never fatal.
 */
export function t(key: string, params?: TParams): string {
  const entry = dict[current][key] ?? dict[DEFAULT][key] ?? key
  return typeof entry === 'function' ? entry(params ?? {}) : entry
}

/** Switches locale (normalized). No-op if unchanged; else notifies listeners. */
export function setLang(lang: string): void {
  const next = normalize(lang)
  if (next === current) return
  current = next
  for (const cb of listeners) cb()
}

/** Subscribes to locale changes; returns an unsubscribe function. */
export function onChange(cb: () => void): () => void {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

/** Reads the initial locale from ?lang=… (normalized). */
export function getInitialLang(): Lang {
  return normalize(new URLSearchParams(location.search).get('lang'))
}

/** Origins allowed to drive the locale over postMessage. */
export function isTrustedParent(origin: string): boolean {
  if (origin === 'https://tradescamp.io' || origin === 'https://www.tradescamp.io') return true
  if (/^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin)) return true
  if (/^http:\/\/localhost(:\d+)?$/i.test(origin)) return true
  if (/^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)) return true
  return false
}

/** Listens for `{type:'set-locale', locale}` from a trusted embedding parent. */
export function initLocaleBridge(): void {
  window.addEventListener('message', (e) => {
    if (!isTrustedParent(e.origin)) return
    if (e.data?.type === 'set-locale') setLang(normalize(e.data.locale))
  })
}
