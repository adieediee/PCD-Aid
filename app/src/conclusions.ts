import { PATIENTS } from './data/patients'
import { emitChange, todayIso, useStoreVersion } from './store'
import { notifyConfirmed } from './notifications'
import type { Verdict } from './ai/engine'
import type { RoleId } from './types'

// In-memory store of conclusions written during a test session (lost on reload).

export interface Conclusion {
  verdict: Verdict
  reasoning: string
  nextSteps: string[]
  author: RoleId
  date: string
  ai: 'agreed' | 'disagreed-kept' | 'disagreed-changed'
  keepNote?: string
}

const store = new Map<string, Conclusion>()

export function saveConclusion(id: string, c: Omit<Conclusion, 'date'>) {
  store.set(id, { ...c, date: todayIso() })
  const p = PATIENTS.find((x) => x.id === id)
  if (p) {
    p.status = c.verdict
    p.lastActivity = todayIso()
    if (c.verdict === 'confirmed') notifyConfirmed(p, c.author) // F08 may flag similar excluded patients
  }
  emitChange()
}

export function useConclusion(id: string | undefined) {
  useStoreVersion()
  return id ? store.get(id) : undefined
}
