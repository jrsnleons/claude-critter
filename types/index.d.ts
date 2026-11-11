export type Action =
  | 'idle'
  | 'nap'
  | 'think'
  | 'read'
  | 'edit'
  | 'run'
  | 'search'
  | 'spawn'
  | 'done'
  | 'error'

export type Main = { action: Action; detail: string; at: number }

export type AgentView = {
  id: string
  toolUseId: string
  desc: string
  type: string
  model: string
  action: Action
  detail: string
  tools: number
  startedAt: number
  endedAt?: number
  failed?: boolean
}

export type Usage = { ctx?: number; rate?: number; rateKind?: string; cost?: number }

export type Turn = { startedAt?: number; tools: number; isWorking: boolean }

export type PlanItem = { content: string; status: 'pending' | 'in_progress' | 'completed' }

export type Mood = { pokes: number; tasks: number; sessions: number }

declare module 'claude-code' {
  interface PluginState {
    'critter-hud': {
      main: Main
      agents: Shaped<AgentView[]>
      usage: Usage
      turn: Turn
      mood: Mood
      tick: number
      isHidden: boolean
      plan: Shaped<PlanItem[]>
    }
  }
}
