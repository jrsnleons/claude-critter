import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Action, AgentView, Main, Mood, PlanItem, Turn, Usage } from '../types'
import { cut, face, modelColor, modelName, scene } from './critter'

const main = atom({ plugin: 'critter-hud', key: 'main' } as const, {
  action: 'idle',
  detail: '',
  at: 0,
} as Main)
const agents = atom({ plugin: 'critter-hud', key: 'agents' } as const, [] as AgentView[], {
  shape: 'agents-1',
})
const usage = atom({ plugin: 'critter-hud', key: 'usage' } as const, {} as Usage)
const turn = atom({ plugin: 'critter-hud', key: 'turn' } as const, {
  tools: 0,
  isWorking: false,
} as Turn)
const mood = atom({ plugin: 'critter-hud', key: 'mood' } as const, {
  pokes: 0,
  tasks: 0,
  sessions: 0,
} as Mood)
const tick = atom({ plugin: 'critter-hud', key: 'tick' } as const, 0)
const isHidden = atom({ plugin: 'critter-hud', key: 'isHidden' } as const, false)
const plan = atom({ plugin: 'critter-hud', key: 'plan' } as const, [] as PlanItem[], {
  shape: 'plan-1',
})

const MOOD_KEY = 'mood'
const TRANSIENT: Action[] = ['done', 'error', 'spawn']
const NAP_AFTER_MS = 2 * 60 * 1000
const KEEP_FINISHED_MS = 20 * 1000

const base = (p: unknown) =>
  typeof p === 'string' ? (p.split('/').pop() ?? p) : ''
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** What a tool call looks like to the critter. */
function describe(tool: string, i: Record<string, unknown>): { action: Action; detail: string } {
  switch (tool) {
    case 'Read':
    case 'NotebookRead':
      return { action: 'read', detail: `Reading ${base(i.file_path)}` }
    case 'Edit':
    case 'MultiEdit':
    case 'NotebookEdit':
      return { action: 'edit', detail: `Editing ${base(i.file_path ?? i.notebook_path)}` }
    case 'Write':
      return { action: 'edit', detail: `Writing ${base(i.file_path)}` }
    case 'Bash':
      return {
        action: 'run',
        detail: str(i.description) || `Running ${cut(str(i.command), 34)}`,
      }
    case 'Grep':
    case 'Glob':
      return { action: 'search', detail: `Searching for ${cut(str(i.pattern), 30)}` }
    case 'WebSearch':
      return { action: 'search', detail: `Googling ${cut(str(i.query), 32)}` }
    case 'WebFetch':
      return { action: 'read', detail: `Reading ${cut(str(i.url).replace(/^https?:\/\//, ''), 34)}` }
    case 'ToolSearch':
      return { action: 'search', detail: 'Looking for the right tool' }
    case 'Agent':
    case 'Task':
      return { action: 'spawn', detail: `Calling a helper: ${cut(str(i.description), 28)}` }
    case 'TodoWrite':
    case 'mcp__ccd_turn__update_plan':
      return { action: 'think', detail: 'Updating the plan' }
    case 'Skill':
      return { action: 'read', detail: `Reading the ${str(i.skill)} skill` }
    default:
      if (tool.startsWith('mcp__')) {
        const name = tool.split('__').pop() ?? tool
        return { action: 'run', detail: `Using ${name.replace(/_/g, ' ')}` }
      }
      return { action: 'think', detail: `Using ${tool}` }
  }
}

async function setMain($: EngineInterface, action: Action, detail: string) {
  const at = await $.clock.now()
  await update($, main, () => ({ action, detail, at }))
}

async function finishAgent($: EngineInterface, match: (a: AgentView) => boolean, failed: boolean) {
  const now = await $.clock.now()
  for (const a of await read($, agents)) {
    if (match(a) && a.endedAt === undefined) {
      $.ui.toast(
        `${modelName(a.model)} ${a.type} ${failed ? 'stopped' : 'finished'}: ${cut(a.desc, 40)} · ${clock(now - a.startedAt)} · ${a.tools} tool${a.tools === 1 ? '' : 's'}`,
      )
    }
  }
  await update($, agents, list =>
    list.map(a =>
      match(a) && a.endedAt === undefined
        ? { ...a, endedAt: now, failed, action: (failed ? 'error' : 'done') as Action, detail: failed ? 'Stopped' : 'Finished' }
        : a,
    ),
  )
}

/** Follows Claude Code's TodoWrite and the desktop app's task list. */
async function trackPlan($: EngineInterface, tool: string, i: Record<string, unknown>) {
  const asItems = (v: unknown): PlanItem[] | undefined =>
    Array.isArray(v)
      ? v.map(x => {
          const o = x as Record<string, unknown>
          const st = o.status
          return {
            content: str(o.content) || str(o.activeForm),
            status: st === 'completed' || st === 'in_progress' ? st : 'pending',
          }
        })
      : undefined
  if (tool === 'TodoWrite') {
    const items = asItems(i.todos)
    if (items !== undefined) await update($, plan, () => items)
    return
  }
  if (tool !== 'mcp__ccd_turn__update_plan') return
  const items = asItems(i.items)
  if (items !== undefined) {
    await update($, plan, () => items)
    return
  }
  const done = Array.isArray(i.done) ? (i.done as unknown[]).filter((n): n is number => typeof n === 'number') : []
  const start = typeof i.start === 'number' ? i.start : undefined
  await update($, plan, list => {
    let next = list.map((it, n) => (done.includes(n + 1) ? { ...it, status: 'completed' as const } : it))
    if (i.advance === true) {
      const cur = next.findIndex(it => it.status === 'in_progress')
      if (cur >= 0) next = next.map((it, n) => (n === cur ? { ...it, status: 'completed' as const } : it))
      const nxt = next.findIndex(it => it.status === 'pending')
      if (nxt >= 0) next = next.map((it, n) => (n === nxt ? { ...it, status: 'in_progress' as const } : it))
    }
    if (start !== undefined) {
      next = next.map((it, n) =>
        n === start - 1 ? { ...it, status: 'in_progress' as const } : it.status === 'in_progress' ? { ...it, status: 'completed' as const } : it,
      )
    }
    return next
  })
}

const bar = (pct: number, n = 10) => {
  const f = Math.max(0, Math.min(n, Math.round((pct / 100) * n)))
  return '▰'.repeat(f) + '▱'.repeat(n - f)
}
const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function idleLine(m: Mood): string {
  if (m.tasks === 0) return 'Hi! Ready when you are.'
  return `${m.tasks} task${m.tasks === 1 ? '' : 's'} done together`
}

function statusText(m: Main, running: number, u: Usage): string {
  const parts = [m.detail || 'Idle']
  if (running > 0) parts.push(`${running} helper${running > 1 ? 's' : ''}`)
  if (u.ctx !== undefined) parts.push(`ctx ${Math.round(u.ctx)}%`)
  return parts.join(' · ')
}

async function onTick($: EngineInterface) {
  const now = await $.clock.now()
  const m = await read($, main)
  const t = await read($, turn)
  const list = await read($, agents)
  const running = list.filter(a => a.endedAt === undefined).length

  if (TRANSIENT.includes(m.action) && now - m.at > 3500) {
    if (t.isWorking) await setMain($, 'think', 'Thinking…')
    else await setMain($, 'idle', idleLine(await read($, mood)))
  } else if (m.action === 'idle' && !t.isWorking && running === 0 && now - m.at > NAP_AFTER_MS) {
    await setMain($, 'nap', 'Napping… wake me with a prompt')
  }

  const stale = list.filter(a => a.endedAt !== undefined && now - a.endedAt > KEEP_FINISHED_MS * 6)
  if (stale.length > 0) {
    await update($, agents, l => l.filter(a => !stale.some(s => s.id === a.id)))
  }

  const hasRecent = list.some(a => a.endedAt !== undefined && now - a.endedAt < KEEP_FINISHED_MS + 1500)
  if (t.isWorking || running > 0 || hasRecent) {
    await update($, tick, () => now)
  }
  $.ui.status(statusText(await read($, main), running, await read($, usage)))
}

export const register: Register = on => {
  let warnedContext = false

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'critter',
      description: 'Show or hide the critter HUD above the prompt',
    })
    const saved = (await $.store.get(MOOD_KEY)) as Mood | undefined
    const m: Mood = {
      pokes: saved?.pokes ?? 0,
      tasks: saved?.tasks ?? 0,
      sessions: (saved?.sessions ?? 0) + 1,
    }
    await update($, mood, () => m)
    await $.store.set(MOOD_KEY, m)
    const current = await read($, main)
    if (current.at === 0) await setMain($, 'idle', idleLine(m))
    $.clock.every(1000, () => void onTick($))

    return next(e)
  })

  on('command.run', { command: 'critter' }, async $ => {
    const hidden = await read($, isHidden)
    await update($, isHidden, () => !hidden)

    return { text: hidden ? 'Critter is back.' : 'Critter hidden. Run /critter to bring it back.' }
  })

  on('prompt.submit', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, turn, () => ({ startedAt: now, tools: 0, isWorking: true }))
    await update($, plan, list => (list.length > 0 && list.every(it => it.status === 'completed') ? [] : list))
    await setMain($, 'think', 'Thinking…')

    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const { action, detail } = describe(tool, e as unknown as Record<string, unknown>)

    if (e.agentId !== undefined) {
      const id = e.agentId
      await update($, agents, list =>
        list.map(a => (a.id === id ? { ...a, action, detail, tools: a.tools + 1 } : a)),
      )
    } else {
      await setMain($, action, detail)
      await update($, turn, x => ({ ...x, tools: x.tools + 1 }))
      await trackPlan($, tool, e as unknown as Record<string, unknown>)
    }

    const ran = await next(e)

    if (ran.isError === true) {
      if (e.agentId !== undefined) {
        const id = e.agentId
        await update($, agents, list =>
          list.map(a => (a.id === id ? { ...a, action: 'error' as Action, detail: `Oops: ${detail}` } : a)),
        )
      } else {
        await setMain($, 'error', `That didn't work: ${detail}`)
      }
    }
    if (e.agentId === undefined && (tool === 'Agent' || tool === 'Task')) {
      const callId = e.tool_use_id
      const isBackground = (e as unknown as { run_in_background?: boolean }).run_in_background === true
      if (!isBackground) await finishAgent($, a => a.toolUseId === callId, ran.isError === true)
    }

    return ran
  })

  on('agent.spawn', async ($, e, next) => {
    const spawned = await next(e)
    const id = spawned.deny === undefined ? spawned.agentId : undefined
    if (id !== undefined && spawned.deny === undefined) {
      const now = await $.clock.now()
      const view: AgentView = {
        id,
        toolUseId: e.tool_use_id,
        desc: e.description,
        type: e.subagentType,
        model: spawned.model,
        action: 'think',
        detail: 'Getting started',
        tools: 0,
        startedAt: now,
      }
      await update($, agents, list => [...list.filter(a => a.id !== id), view].slice(-12))
      await setMain($, 'spawn', `Sent ${modelName(spawned.model)} to ${cut(e.description, 30)}`)
      $.ui.toast(`${modelName(spawned.model)} ${e.subagentType} started: ${cut(e.description, 48)}`)
    }

    return spawned
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) {
      const id = e.agentId
      await finishAgent($, a => a.id === id, e.isAborted)
    } else {
      await update($, turn, x => ({ ...x, isWorking: false }))
      if (e.isAborted) {
        await setMain($, 'idle', 'Stopped. Ready when you are.')
      } else {
        const m = await read($, mood)
        const next2: Mood = { ...m, tasks: m.tasks + 1 }
        await update($, mood, () => next2)
        await $.store.set(MOOD_KEY, next2)
        await setMain($, 'done', 'All done!')
      }
    }

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    const top = [...e.rateLimits].sort((a, b) => b.percentUsed - a.percentUsed)[0]
    const u: Usage = {
      ctx: e.context.percent,
      rate: top?.percentUsed,
      rateKind: top?.kind,
      cost: e.cost?.usd,
    }
    await update($, usage, () => u)
    if ((u.ctx ?? 0) >= 80 && !warnedContext) {
      warnedContext = true
      $.ui.toast(`Context is ${Math.round(u.ctx ?? 0)}% full. The critter is sweating.`)
    }

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, isHidden))) return next(e)

    const m = await read($, main)
    const list = await read($, agents)
    const u = await read($, usage)
    const t = await read($, turn)
    const md = await read($, mood)
    const items = await read($, plan)
    const now = Math.max(await read($, tick), m.at)
    const planInfo =
      items.length > 0
        ? {
            done: items.filter(it => it.status === 'completed').length,
            total: items.length,
            current: items.find(it => it.status === 'in_progress')?.content ?? '',
          }
        : undefined

    const running = list.filter(a => a.endedAt === undefined)
    const recent = list.filter(a => a.endedAt !== undefined && now - a.endedAt < KEEP_FINISHED_MS)
    const shown = [...running, ...recent]
    const finished = list.filter(a => a.endedAt !== undefined).length
    const isSweating = (u.ctx ?? 0) >= 80

    const stats = {
      ctx: u.ctx,
      rate: u.rate,
      cost: u.cost,
      tools: t.tools,
      finished,
    }

    const subline =
      running.length > 0
        ? `${running.length} helper${running.length > 1 ? 's' : ''} working`
        : `Session ${md.sessions}`

    const agentRows = shown.map(a => ({
      color: modelColor(a.model),
      head: `● ${modelName(a.model)} · ${a.type}`,
      body: `${cut(a.desc, 40)} — ${a.detail} · ${a.tools} tool${a.tools === 1 ? '' : 's'} · ${clock((a.endedAt ?? now) - a.startedAt)}`,
      isDone: a.endedAt !== undefined,
    }))
    const timer =
      t.isWorking && t.startedAt !== undefined ? `Working for ${clock(now - t.startedAt)}` : undefined

    if (e.surface === 'terminal') {
      const { Box, Text } = $.ui.resolve(e)
      const info: string[] = []
      if (u.ctx !== undefined) info.push(`ctx ${bar(u.ctx)} ${Math.round(u.ctx)}%`)
      if (u.rate !== undefined) info.push(`limit ${bar(u.rate, 6)} ${Math.round(u.rate)}%`)
      if (u.cost !== undefined) info.push(`$${u.cost.toFixed(2)}`)
      if (timer !== undefined) info.push(timer)
      if (t.tools > 0) info.push(`${t.tools} tool${t.tools > 1 ? 's' : ''}`)
      return (
        <Box flexDirection="column">
          <Box flexDirection="row" gap={1}>
            <Text color="#D97757">{face(m.action)}</Text>
            <Text>{m.detail}</Text>
          </Box>
          {planInfo !== undefined && (
            <Text>
              Plan {bar((planInfo.done / planInfo.total) * 100)} {planInfo.done}/{planInfo.total}
              {planInfo.current ? ` · ${planInfo.current}` : ''}
            </Text>
          )}
          {info.length > 0 && <Text dimColor>{info.join(' · ')}</Text>}
          {agentRows.map(r => (
            <Text dimColor={r.isDone}>
              <Text color={r.color}>{face(r.isDone ? 'done' : 'think')} {r.head}</Text> {r.body}
            </Text>
          ))}
        </Box>
      )
    }

    const { Box, Text, Svg } = $.ui.resolve(e)
    const svg = scene({
      action: m.action,
      bubble: m.detail || 'Hi!',
      subline,
      agents: shown,
      extra: Math.max(0, shown.length - 4),
      isSweating,
      plan: planInfo,
      stats,
    })

    return (
      <Box flexDirection="column" gap={0}>
        <Svg source={svg} alt={`Critter: ${m.detail || 'idle'}`} />
        {timer !== undefined && (
          <Text dimColor size="footnote">
            {timer}
          </Text>
        )}
        {agentRows.map(r => (
          <Text size="footnote" dimColor={r.isDone}>
            <Text color={r.color} weight="medium">
              {r.head}
            </Text>{' '}
            {r.body}
          </Text>
        ))}
      </Box>
    )
  })
}
