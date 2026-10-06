/** What bridge/console.mjs sends. */

export type StepStatus = 'running' | 'waiting' | 'done' | 'error' | 'blocked' | 'rejected' | 'interrupted'

export type Step = {
  id: string
  name: string
  server: string
  tool: string
  /** Set on a call that hands work to one of Nexy's agents: that agent's id. */
  agent?: string | null
  /** Set on a call one of her agents made: that agent's id. */
  by?: string | null
  /** The id of the step that started the agent which made this call. */
  parent?: string | null
  input: Record<string, unknown>
  status: StepStatus
  startedAt: number
  endedAt: number | null
  result: string
}

export type Task = {
  id: string
  brand?: string | null
  /** Where the owner asked: out loud, on Telegram, or a routine they left scheduled. */
  via?: 'voz' | 'telegram' | 'rutina' | 'llamada'
  text: string
  status: 'running' | 'done' | 'error' | 'interrupted'
  startedAt: number
  endedAt: number | null
  reply: string
  steps: Step[]
}

export type Approval = {
  id: string
  taskId: string
  brand?: string | null
  /** The exact account it goes out on, e.g. "@nxus.ai · NXUS AI". */
  account?: string | null
  /** An invoice in plain Spanish, with the client by name (Zoho only). */
  lines?: string[] | null
  name: string
  server: string
  tool: string
  input: Record<string, unknown>
  createdAt: number
  expiresAt: number
}

export type Server = { name: string; status: string }

export type Brand = {
  id: string
  nombre: string
  color: string
  descripcion: string
  cuentas: { correo: string[]; redes: string[]; notion: string[] }
  /** Accounts this brand publishes to — and the only ones it can. */
  conexiones?: Array<{ servicio: string; id: string; nombre: string }>
}
export type Brands = { grupo?: string; activa: string; marcas: Brand[] }

export type Department = { id: string; label: string; short?: string; icon: string; hace?: string }
export type Mold = { nombre: string; resumen: string; fuente: string | null; marca: string | null }
export type Agent = { id: string; label: string; icon: string; dept: string; description: string }
export type Org = { departments: Department[]; agents: Agent[]; molds?: Mold[] }

export type BrainNode = {
  id: string
  label: string
  kind: 'core' | 'brand' | 'note' | 'ref' | 'dept' | 'agent' | 'person' | 'fact'
  color?: string
  icon?: string
  detail?: string
  brand?: string
  active?: boolean
}
export type Brain = { nodes: BrainNode[]; links: Array<{ source: string; target: string }> }
