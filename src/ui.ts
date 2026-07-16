/** Creates a styled button for the debug / camera overlay panels. */
export function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = [
    'padding:8px 10px',
    'background:#333',
    'color:#fff',
    'border:1px solid #555',
    'border-radius:6px',
    'cursor:pointer',
    'font:inherit',
    'text-align:left',
  ].join(';')
  btn.addEventListener('mouseenter', () => (btn.style.background = '#444'))
  btn.addEventListener('mouseleave', () => (btn.style.background = '#333'))
  return btn
}
