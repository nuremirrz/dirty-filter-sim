import { t, onChange } from './i18n'
import { STATE_DATA, AIRFLOW_NORM_MIN, AIRFLOW_NORM_MAX, type GameState } from './state'

/** What the player has actually done, independent of where the guided flow sits. */
export interface TaskProgress {
  supplyMeasured: boolean
  filterReplaced: boolean
  airflowRechecked: boolean
}

// The checklist is keyed to real accomplishments, not the flow's position, so a
// task done out of order — e.g. replacing the filter before the first reading —
// still ticks the moment it actually happens.
const TASKS: { key: string; done: (p: TaskProgress) => boolean }[] = [
  { key: 'task.check_supply', done: (p) => p.supplyMeasured },
  { key: 'task.replace_filter', done: (p) => p.filterReplaced },
  { key: 'task.remeasure', done: (p) => p.airflowRechecked },
]

export interface InfoPanelApi {
  /** Reflects the current step, the taken reading, and what's been accomplished. */
  update: (
    state: GameState,
    reading: { value: number; ok: boolean } | null,
    progress: TaskProgress,
  ) => void
}

const el = (tag: string, css: string): HTMLDivElement => {
  const node = document.createElement(tag) as HTMLDivElement
  node.style.cssText = css
  return node
}

/**
 * Left info panel (light/neutral): level name + goal, a task checklist that
 * ticks off as the flow advances, a contextual hint, and the airflow readout.
 * All text comes from i18n and re-renders on locale change.
 */
export function createInfoPanel(): InfoPanelApi {
  const panel = el(
    'div',
    [
      'position:fixed',
      'top:16px',
      'left:16px',
      'z-index:20',
      'width:300px',
      'max-width:calc(100vw - 32px)',
      'box-sizing:border-box',
      'padding:16px 18px',
      'background:#ffffff',
      'color:#1f2430',
      'border:1px solid rgba(0,0,0,0.08)',
      'border-radius:14px',
      'box-shadow:0 8px 28px rgba(0,0,0,0.16)',
      'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif',
      'font-size:14px',
      'line-height:1.5',
    ].join(';'),
  )

  const eyebrow = el('div', 'font-size:11px;font-weight:600;letter-spacing:0.08em;color:#8a94a6')
  const title = el('div', 'font-size:19px;font-weight:600;color:#111827;margin:2px 0 6px')
  const desc = el('div', 'font-size:13px;color:#6b7280')

  const tasksHead = el(
    'div',
    'display:flex;justify-content:space-between;align-items:baseline;font-size:11px;font-weight:600;letter-spacing:0.06em;color:#8a94a6;margin:16px 0 8px',
  )
  const tasksTitle = el('span', '')
  const tasksCount = el('span', 'font-size:12px;color:#6b7280;letter-spacing:0')
  tasksHead.append(tasksTitle, tasksCount)

  const tasksList = el('div', 'display:flex;flex-direction:column;gap:7px')
  const taskRows = TASKS.map(() => {
    const row = el('div', 'display:flex;align-items:center;gap:9px')
    const mark = el('span', 'font-size:15px;line-height:1;flex:0 0 auto')
    const label = el('span', 'font-size:14px')
    row.append(mark, label)
    tasksList.appendChild(row)
    return { mark, label }
  })

  const hintHead = el(
    'div',
    'font-size:11px;font-weight:600;letter-spacing:0.06em;color:#d08700;margin:16px 0 6px',
  )
  const hintText = el('div', 'font-size:13px;color:#5b6472')

  const reading = el(
    'div',
    'display:none;margin-top:14px;padding-top:12px;border-top:1px solid rgba(0,0,0,0.07)',
  )
  const readingValue = el('div', 'font-size:24px;font-weight:600')
  const readingNorm = el('div', 'font-size:12px;color:#8a94a6')
  reading.append(readingValue, readingNorm)

  panel.append(eyebrow, title, desc, tasksHead, tasksList, hintHead, hintText, reading)
  document.body.appendChild(panel)

  let cur: GameState = 'overview'
  let curReading: { value: number; ok: boolean } | null = null
  let curProgress: TaskProgress = {
    supplyMeasured: false,
    filterReplaced: false,
    airflowRechecked: false,
  }

  const fill = () => {
    eyebrow.textContent = t('ui.level')
    title.textContent = t('level.title')
    desc.textContent = t('level.desc')
    tasksTitle.textContent = t('ui.tasks')
    hintHead.textContent = t('ui.hint')
    hintText.textContent = t(STATE_DATA[cur].hintKey)

    let done = 0
    taskRows.forEach((row, i) => {
      const isDone = TASKS[i].done(curProgress)
      if (isDone) done += 1
      row.mark.textContent = isDone ? '✅' : '⬜'
      row.label.textContent = t(TASKS[i].key)
      row.label.style.color = isDone ? '#9aa3b2' : '#374151'
      row.label.style.textDecoration = isDone ? 'line-through' : 'none'
    })
    tasksCount.textContent = `${done}/${TASKS.length}`

    if (curReading) {
      readingValue.textContent = t('hud.airflow', { value: curReading.value })
      readingValue.style.color = curReading.ok ? '#2e7d32' : '#c62828'
      readingNorm.textContent = t('hud.norm', { min: AIRFLOW_NORM_MIN, max: AIRFLOW_NORM_MAX })
      reading.style.display = 'block'
    } else {
      reading.style.display = 'none'
    }
  }
  fill()
  onChange(fill) // re-render on locale change, even mid-level

  return {
    update: (state, r, progress) => {
      cur = state
      curReading = r
      curProgress = progress
      fill()
    },
  }
}
