import type { Action, AgentView } from '../types'

// The pixel critter, drawn as SVG markup. Local coordinates: the body sits in
// 0..40 x 0..30; props (page, terminal, magnifier...) sit to its right.

const INK = '#1f1e1d'
export const CORAL = '#D97757'

export function modelColor(model: string): string {
  const m = model.toLowerCase()
  if (m.includes('sonnet')) return '#8B7CF6'
  if (m.includes('haiku')) return '#2FB8A6'
  if (m.includes('fable')) return '#E0A43B'
  if (m.includes('opus')) return CORAL
  return '#9A968E'
}

export function modelName(model: string): string {
  const m = model.toLowerCase()
  for (const n of ['opus', 'sonnet', 'haiku', 'fable']) {
    if (m.includes(n)) return n.charAt(0).toUpperCase() + n.slice(1)
  }
  return model === '' ? 'Agent' : model
}

export const esc = (s: string) =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const cut = (s: string, n: number) =>
  s.length > n ? s.slice(0, n - 1) + '…' : s

const STYLE = `<style>
.t{font:500 14px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;fill:#3d3929}
.s{font:400 11px -apple-system,BlinkMacSystemFont,system-ui,sans-serif;fill:#6b675f}
.bub{fill:#ffffff;stroke:#d9d5cc}
.track{fill:#e6e2d9}
.v{font:500 12px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#3d3929}
.rule{stroke:#e6e2d9}
@media (prefers-color-scheme:dark){.v{fill:#ece9e2}.rule{stroke:#3a3934}.t{fill:#ece9e2}.s{fill:#a8a49b}.bub{fill:#2b2a27;stroke:#4a4842}.track{fill:#3a3934}}
.blink{transform-box:fill-box;transform-origin:center;animation:blink 4s infinite}
.look{animation:look 2.6s ease-in-out infinite}
.scan{animation:scan 1.1s ease-in-out infinite}
.hop{animation:hop 1.8s ease-in-out infinite}
.hopfast{animation:hop .55s ease-in-out infinite}
.shake{animation:shake .35s linear infinite}
.tap{animation:tap .28s ease-in-out infinite}
.tap2{animation:tap .28s .14s ease-in-out infinite}
.dot{animation:dot 1.2s infinite}
.d2{animation-delay:.2s}.d3{animation-delay:.4s}
.sweep{animation:sweep 1.6s ease-in-out infinite}
.pop{transform-box:fill-box;transform-origin:bottom center;animation:pop 1.4s ease-out infinite}
.breathe{transform-box:fill-box;transform-origin:bottom center;animation:breathe 3.2s ease-in-out infinite}
.shimmer{animation:shimmer 1.3s linear infinite}
.drip{animation:drip 1.6s ease-in infinite}
@keyframes blink{0%,92%,100%{transform:scaleY(1)}96%{transform:scaleY(.1)}}
@keyframes look{0%,100%{transform:translateX(0)}30%{transform:translateX(-2px)}70%{transform:translateX(2px)}}
@keyframes scan{0%,100%{transform:translateX(-1.5px)}50%{transform:translateX(2px)}}
@keyframes hop{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-2px)}75%{transform:translateX(2px)}}
@keyframes tap{0%,100%{transform:translateY(0)}50%{transform:translateY(2px)}}
@keyframes dot{0%,100%{opacity:.2}50%{opacity:1}}
@keyframes sweep{0%,100%{transform:translate(0,0)}50%{transform:translate(9px,-3px)}}
@keyframes pop{0%{transform:scale(0)}45%,100%{transform:scale(1)}}
@keyframes breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(1.05)}}
@keyframes shimmer{0%{transform:translateX(-12px)}100%{transform:translateX(40px)}}
@keyframes drip{0%{transform:translateY(0);opacity:1}100%{transform:translateY(6px);opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>`

function eyes(action: Action): string {
  const pair = (cls: string) =>
    `<g class="${cls}"><rect class="blink" x="13" y="11" width="3" height="5" fill="${INK}"/><rect class="blink" x="24" y="11" width="3" height="5" fill="${INK}"/></g>`
  switch (action) {
    case 'nap':
      return `<rect x="12" y="14" width="5" height="1.6" fill="${INK}"/><rect x="23" y="14" width="5" height="1.6" fill="${INK}"/>`
    case 'done':
      return `<path d="M12 15l2.5-3 2.5 3M23 15l2.5-3 2.5 3" stroke="${INK}" stroke-width="1.6" fill="none"/>`
    case 'error':
      return `<path d="M12 11l4 4m0-4l-4 4M23 11l4 4m0-4l-4 4" stroke="${INK}" stroke-width="1.5"/>`
    case 'read':
    case 'search':
      return pair('scan')
    default:
      return pair('look')
  }
}

function body(color: string, action: Action, isFull: boolean): string {
  const x = isFull ? 3 : 6
  const w = isFull ? 34 : 28
  const claw = action === 'edit' ? ' class="tap"' : ''
  const claw2 = action === 'edit' ? ' class="tap2"' : ''
  return [
    `<rect x="${x}" y="6" width="${w}" height="16" fill="${color}"/>`,
    `<rect${claw} x="${x - 6}" y="11" width="6" height="6" fill="${color}"/>`,
    `<rect${claw2} x="${x + w}" y="11" width="6" height="6" fill="${color}"/>`,
    ...[8, 14, 22, 28].map(
      lx => `<rect x="${lx}" y="22" width="4" height="6" fill="${color}"/>`,
    ),
  ].join('')
}

function props(action: Action): string {
  switch (action) {
    case 'think':
      return `<rect x="42" y="-6" width="24" height="12" rx="6" class="bub"/><circle class="dot" cx="48" cy="0" r="1.6" fill="#8a867d"/><circle class="dot d2" cx="54" cy="0" r="1.6" fill="#8a867d"/><circle class="dot d3" cx="60" cy="0" r="1.6" fill="#8a867d"/>`
    case 'read':
      return `<rect x="46" y="4" width="16" height="20" rx="1.5" class="bub"/><path d="M49 9h10M49 13h10M49 17h7" stroke="#a8a49b" stroke-width="1.2"/>`
    case 'edit':
      return `<rect x="44" y="18" width="24" height="8" rx="1.5" class="bub"/><path d="M47 21h2M51 21h2M55 21h2M59 21h2M63 21h2M49 24h14" stroke="#a8a49b" stroke-width="1.2"/>`
    case 'run':
      return `<rect x="44" y="2" width="26" height="20" rx="2" fill="${INK}"/><path d="M48 8l3 3-3 3" stroke="#7FD18B" stroke-width="1.4" fill="none"/><rect class="dot" x="53" y="13" width="6" height="1.6" fill="#7FD18B"/>`
    case 'search':
      return `<g class="sweep"><circle cx="52" cy="10" r="6" fill="none" stroke="#8a867d" stroke-width="2"/><path d="M56.5 14.5l5 5" stroke="#8a867d" stroke-width="2.4"/></g>`
    case 'spawn':
      return `<g class="pop"><rect x="48" y="14" width="16" height="9" fill="#8B7CF6"/><rect x="45" y="16" width="3" height="3" fill="#8B7CF6"/><rect x="64" y="16" width="3" height="3" fill="#8B7CF6"/><rect x="52" y="17" width="2" height="3" fill="${INK}"/><rect x="58" y="17" width="2" height="3" fill="${INK}"/><rect x="50" y="23" width="2" height="3" fill="#8B7CF6"/><rect x="60" y="23" width="2" height="3" fill="#8B7CF6"/></g>`
    case 'done':
      return `<path class="dot" d="M-2 -2l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#E8B04B"/><path class="dot d3" d="M46 0l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#E8B04B"/><path class="dot d2" d="M54 14l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" fill="#E8B04B"/>`
    case 'error':
      return `<path class="drip" d="M42 0q3 4 0 6q-3-2 0-6z" fill="#6FB6E8"/>`
    case 'nap':
      return `<text class="s dot" x="42" y="6">z</text><text class="s dot d3" x="48" y="-1" font-size="12">Z</text>`
    default:
      return ''
  }
}

function wrapClass(action: Action): string {
  if (action === 'done') return 'hopfast'
  if (action === 'error') return 'shake'
  if (action === 'think') return 'hop'
  return 'breathe'
}

/** One critter, in its own local coordinates. */
export function critter(action: Action, color: string, isSweating = false): string {
  const sweat = isSweating
    ? `<path class="drip" d="M38 -2q2.5 3.5 0 5q-2.5-1.5 0-5z" fill="#6FB6E8"/>`
    : ''
  return `<g class="${wrapClass(action)}">${body(color, action, isSweating)}${eyes(action)}</g>${props(action)}${sweat}`
}

export type SceneInput = {
  action: Action
  bubble: string
  subline: string
  agents: AgentView[]
  extra: number
  isSweating: boolean
  plan?: { done: number; total: number; current: string }
  stats?: { ctx?: number; rate?: number; cost?: number; tools: number; finished: number }
}

const level = (pct: number) => (pct >= 85 ? '#D9534F' : pct >= 60 ? '#E0A43B' : '#5CB85C')

/** The bottom strip: context and limit as bars, then cost, tools, finished helpers. */
function statsStrip(s: SceneInput, y: number): string {
  const st = s.stats
  if (st === undefined) return ''
  let x = 18
  const out: string[] = []
  const meter = (label: string, pct: number) => {
    const w = 110
    const f = Math.max(4, Math.round((Math.min(100, pct) / 100) * w))
    out.push(
      `<text class="s" x="${x}" y="${y}">${label}</text>`,
      `<rect class="track" x="${x + 52}" y="${y - 7}" width="${w}" height="7" rx="3.5"/>`,
      `<rect x="${x + 52}" y="${y - 7}" width="${f}" height="7" rx="3.5" fill="${level(pct)}"/>`,
      `<text class="v" x="${x + 52 + w + 8}" y="${y}">${Math.round(pct)}%</text>`,
    )
    x += 52 + w + 54
  }
  const chip = (text: string) => {
    out.push(`<text class="v" x="${x}" y="${y}">${esc(text)}</text>`)
    x += text.length * 7.4 + 24
  }
  if (st.ctx !== undefined) meter('Context', st.ctx)
  if (st.rate !== undefined) meter('Limit', st.rate)
  if (st.cost !== undefined) chip(`$${st.cost.toFixed(2)}`)
  if (st.tools > 0) chip(`${st.tools} tool${st.tools === 1 ? '' : 's'} this turn`)
  if (st.finished > 0) chip(`${st.finished} helper${st.finished === 1 ? '' : 's'} done`)
  if (out.length === 0) return ''
  return `<line x1="14" y1="${y - 18}" x2="776" y2="${y - 18}" class="rule"/>${out.join('')}`
}

function planBar(s: SceneInput, x: number): string {
  if (s.plan === undefined || s.plan.total === 0) {
    return `<text class="s" x="${x + 4}" y="72">${esc(cut(s.subline, 52))}</text>`
  }
  const w = 220
  const f = Math.round((s.plan.done / s.plan.total) * w)
  return `<text class="s" x="${x + 4}" y="68">Plan ${s.plan.done}/${s.plan.total}${s.plan.current ? ' · ' + esc(cut(s.plan.current, 34)) : ''}</text><rect class="track" x="${x + 4}" y="75" width="${w}" height="6" rx="3"/><rect x="${x + 4}" y="75" width="${Math.max(f, 6)}" height="6" rx="3" fill="${CORAL}"/>`
}

/** The whole band: main critter, speech bubble, one mini critter per subagent. */
export function scene(s: SceneInput): string {
  const width = 790
  const strip = statsStrip(s, 134)
  const height = strip === '' ? 112 : 144
  const text = cut(s.bubble, 34)
  const bw = Math.min(290, Math.max(120, text.length * 7.6 + 28))
  const bx = 184
  const bubble = `<path d="M${bx + 1} 30l-11 7 11 3z" class="bub"/><rect x="${bx}" y="18" width="${bw}" height="32" rx="11" class="bub"/><text class="t" x="${bx + 13}" y="39">${esc(text)}</text>${planBar(s, bx)}`

  const minis = s.agents
    .slice(0, 4)
    .map((a, i) => {
      const x = 496 + i * 72
      const color = modelColor(a.model)
      const isDone = a.endedAt !== undefined
      const action: Action = isDone ? (a.failed ? 'error' : 'done') : a.action
      const fill = isDone
        ? `<rect x="0" y="0" width="36" height="3" rx="1.5" fill="${a.failed ? '#D9534F' : '#5CB85C'}"/>`
        : `<clipPath id="c${i}"><rect x="0" y="0" width="36" height="3" rx="1.5"/></clipPath><g clip-path="url(#c${i})"><rect class="shimmer" x="0" y="0" width="12" height="3" rx="1.5" fill="${color}"/></g>`
      const bar = `<g transform="translate(${x + 3} 96)"><rect class="track" x="0" y="0" width="36" height="3" rx="1.5"/>${fill}</g>`
      return `<g opacity="${isDone ? 0.6 : 1}"><g transform="translate(${x + 4} 32) scale(.85)">${critter(action, color)}</g><text class="s" x="${x + 21}" y="88" text-anchor="middle">${esc(modelName(a.model))}</text>${bar}</g>`
    })
    .join('')
  const more =
    s.extra > 0
      ? `<text class="s" x="${496 + 4 * 72 - 10}" y="60">+${s.extra}</text>`
      : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${STYLE}<g transform="translate(18 34) scale(2.2)">${critter(s.action, CORAL, s.isSweating)}</g>${bubble}${minis}${more}${strip}</svg>`
}

const FACES: Record<Action, string> = {
  idle: '(•ᴗ•)',
  nap: '(-.-) zZ',
  think: '(•_•) …',
  read: '(o_o) [≡]',
  edit: '(•̀ᴗ•́)⌨',
  run: '(•_•) >_',
  search: '(o_o)⌕',
  spawn: '(•ᴗ•)ノ+',
  done: '\\(^ᴗ^)/',
  error: '(×_×);',
}

/** The terminal has no Svg: a kaomoji critter instead. */
export const face = (action: Action) => FACES[action]
