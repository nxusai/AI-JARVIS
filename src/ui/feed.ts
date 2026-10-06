import { useEffect, useState } from 'react'
import { BRIDGE_HTTP_URL, BRIDGE_WS_URL } from '../config'
import type { Approval, Brands, Org, Server, Task } from '../console/types'

/**
 * What the bridge knows right now — connectors, tasks, approvals, brands, the
 * team — read from the same feed the console uses, for the command panels on
 * Nexy's face. Read only: `?watch=1` tells the bridge this page answers
 * nothing, so it never counts as a place approvals are waiting.
 */
export type Feed = {
  live: boolean
  servers: Server[]
  tasks: Task[]
  approvals: Approval[]
  brands: Brands | null
  org: Org | null
  /** Round trip to the bridge's /health, in ms; null until measured. */
  latency: number | null
}

const EMPTY: Feed = { live: false, servers: [], tasks: [], approvals: [], brands: null, org: null, latency: null }

export function useFeed(): Feed {
  const [feed, setFeed] = useState<Feed>(EMPTY)

  useEffect(() => {
    let stop = false
    let ws: WebSocket | null = null
    let retry: ReturnType<typeof setTimeout> | null = null
    const patch = (p: Partial<Feed>) => setFeed((f) => ({ ...f, ...p }))

    const open = () => {
      ws = new WebSocket(`${BRIDGE_WS_URL.replace(/\/+$/, '')}/console?watch=1`)
      ws.onopen = () => patch({ live: true })
      ws.onclose = () => {
        patch({ live: false })
        if (!stop) retry = setTimeout(open, 3000)
      }
      ws.onmessage = (ev) => {
        let msg: { type?: string; [k: string]: unknown }
        try {
          msg = JSON.parse(String(ev.data))
        } catch {
          return
        }
        if (msg.type === 'snapshot') {
          patch({
            servers: (msg.servers as Server[]) ?? [],
            tasks: (msg.tasks as Task[]) ?? [],
            approvals: (msg.approvals as Approval[]) ?? [],
            brands: (msg.brands as Brands) ?? null,
            org: (msg.org as Org) ?? null,
          })
        } else if (msg.type === 'servers') patch({ servers: (msg.servers as Server[]) ?? [] })
        else if (msg.type === 'approvals') patch({ approvals: (msg.approvals as Approval[]) ?? [] })
        else if (msg.type === 'brands') patch({ brands: (msg.brands as Brands) ?? null })
        else if (msg.type === 'org') patch({ org: (msg.org as Org) ?? null })
        else if (msg.type === 'task') {
          const task = msg.task as Task
          setFeed((f) => ({
            ...f,
            tasks: [task, ...f.tasks.filter((t) => t.id !== task.id)].sort((a, b) => b.startedAt - a.startedAt).slice(0, 60),
          }))
        }
      }
    }
    open()

    // Latency: a real round trip, not a number painted on.
    const ping = async () => {
      const t0 = performance.now()
      try {
        await fetch(`${BRIDGE_HTTP_URL.replace(/\/+$/, '')}/health`, { cache: 'no-store' })
        patch({ latency: Math.round(performance.now() - t0) })
      } catch {
        patch({ latency: null })
      }
    }
    void ping()
    const pinger = setInterval(ping, 15_000)

    return () => {
      stop = true
      if (retry) clearTimeout(retry)
      clearInterval(pinger)
      ws?.close()
    }
  }, [])

  return feed
}
