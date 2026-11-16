import { PATIENTS, STALE_DAYS, TODAY, idleDays, isStale } from './data/patients'
import { compare, findSimilar } from './ai/engine'
import { DEFECT_LABEL, ROLES, lowerFirst } from './labels'
import { emitChange, useStoreVersion } from './store'
import type { Patient, RoleId } from './types'

// Notifications: seeded mock events + events created during the test session.

export type NotifType = 'images' | 'genetics' | 'report' | 'results' | 'sharing' | 'conclusion' | 'stale' | 'ai'
export type ProfileTab = 'anamnesis' | 'nno' | 'hsvm' | 'tem' | 'if' | 'genetics'

export interface Notification {
  id: string
  type: NotifType
  patientId: string
  title: string
  text: string
  at: number // ms timestamp in prototype time
  to: RoleId[]
  tab?: ProfileTab
  reeval?: { trigger: string; candidate: string } // F08
}

export const NOTIF_TYPES: { type: NotifType; label: string }[] = [
  { type: 'images', label: 'Nové snímky z TEM' },
  { type: 'genetics', label: 'Výsledky genetiky' },
  { type: 'report', label: 'Správy z TEM' },
  { type: 'results', label: 'Výsledky nNO, HSVM a IF' },
  { type: 'sharing', label: 'Zdieľané prípady' },
  { type: 'conclusion', label: 'Závery prípadov' },
  { type: 'stale', label: 'Prípady bez pohybu' },
  { type: 'ai', label: 'AI: prehodnotenie vylúčených' },
]

// Quick filter chips on the page – types grouped so there are only a few.
export type NotifGroup = 'results' | 'tem' | 'cases' | 'ai'
export const NOTIF_GROUPS: { group: NotifGroup; label: string; types: NotifType[] }[] = [
  { group: 'results', label: 'Výsledky', types: ['genetics', 'results'] },
  { group: 'tem', label: 'Snímky a správy', types: ['images', 'report'] },
  { group: 'cases', label: 'Prípady', types: ['sharing', 'conclusion', 'stale'] },
  { group: 'ai', label: 'AI', types: ['ai'] },
]

// Histopathologist only evaluates images and writes the report, so a new batch of images is the only event she must act on.
const ROLE_TYPES: Partial<Record<RoleId, NotifType[]>> = { michaela: ['images'] }

/** Notification types a role can receive – also limits the settings and filter chips. */
export const typesFor = (role: RoleId) => NOTIF_TYPES.filter((t) => ROLE_TYPES[role]?.includes(t.type) ?? true)

// Prototype clock: fixed TODAY + real time elapsed since the app was loaded.
const LOADED = Date.now()
export const now = () => TODAY.getTime() + (Date.now() - LOADED)
const H = 3_600_000
const D = 24 * H
const LAB: RoleId[] = ['michaela', 'lucia']

export function relativeTime(at: number) {
  const min = Math.round((now() - at) / 60_000)
  if (min < 1) return 'práve teraz'
  if (min < 60) return `pred ${min} min`
  if (min < 24 * 60) return `pred ${Math.round(min / 60)} h`
  if (min < 48 * 60) return 'včera'
  if (min < 30 * 24 * 60) return `pred ${Math.round(min / (24 * 60))} d`
  const d = new Date(at)
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}

const byId = (id: string) => PATIENTS.find((p) => p.id === id)!

/** Short description of why a confirmed case is notable, e.g. "normálny TEM, DNAH11". */
const caseKey = (p: Patient) =>
  [p.exams.tem.defect ? lowerFirst(DEFECT_LABEL[p.exams.tem.defect]).replace('normálna ultraštruktúra', 'normálny TEM') : null, p.exams.genetics.gene]
    .filter(Boolean).join(', ')

/** F08: when a case gets confirmed, flag similar patients that were excluded before. */
function reevalFor(trigger: Patient, at: number): Notification[] {
  return findSimilar(trigger)
    .filter((c) => c.patient.status === 'excluded')
    .map((c) => ({
      id: `ai-${trigger.id}-${c.patient.id}`,
      type: 'ai' as const,
      patientId: c.patient.id,
      title: `${c.patient.id} môže stáť za prehodnotenie`,
      text: `Pribudol potvrdený prípad ${trigger.id} (${caseKey(trigger)}). ${c.patient.id} bol vylúčený v roku ${c.patient.lastActivity.slice(0, 4)} a má s ním podobné výsledky.`,
      at,
      to: [c.patient.owner, 'lucia'] as RoleId[],
      reeval: { trigger: trigger.id, candidate: c.patient.id },
    }))
}

function seed(): Notification[] {
  const t = TODAY.getTime()
  const list: Notification[] = [
    {
      id: 'gen-0118', type: 'genetics', patientId: 'PCD-0118', tab: 'genetics', at: t - 26 * H, to: ['vojtech', ...LAB],
      title: 'Prišiel výsledok genetiky', text: 'Patogénny variant v géne DNAH11 · externé genetické pracovisko',
    },
    {
      id: 'conc-0118', type: 'conclusion', patientId: 'PCD-0118', at: t - 22 * H, to: LAB,
      title: 'Záver: potvrdená PCD', text: `Autor záveru: ${ROLES.vojtech.name} · ${ROLES.vojtech.title}`,
    },
    ...reevalFor(byId('PCD-0118'), t - 22 * H),
    {
      id: 'img-0163', type: 'images', patientId: 'PCD-0163', tab: 'tem', at: t - 3 * H, to: ['michaela'],
      title: 'Nové snímky z TEM (14)', text: `Nahrané: ${ROLES.lucia.name} · snímky čakajú na vyhodnotenie v CiliaScane`,
    },
    {
      id: 'rep-0142', type: 'report', patientId: 'PCD-0142', tab: 'tem', at: t - 4 * D, to: ['vojtech'],
      title: 'Nová správa z TEM', text: `Autor: ${ROLES.michaela.name} · normálna ultraštruktúra, 142 riasiniek`,
    },
    {
      id: 'share-0163', type: 'sharing', patientId: 'PCD-0163', at: t - 11 * D, to: LAB,
      title: 'Prípad zdieľaný s vami', text: `Zdieľa: ${ROLES.vojtech.name} · ${ROLES.vojtech.title}`,
    },
    {
      id: 'nno-0163', type: 'results', patientId: 'PCD-0163', tab: 'nno', at: t - 10 * D, to: LAB,
      title: 'Zapísané nNO: 44 ppb', text: 'Pod hranicou 180 ppb',
    },
  ]
  // Stuck cases – one reminder per case once it crosses the threshold.
  for (const p of PATIENTS.filter(isStale)) {
    const pending = (['nno', 'hsvm', 'tem', 'if', 'genetics'] as const).filter((k) => p.exams[k].status === 'pending')
    const names = { nno: 'nNO', hsvm: 'HSVM', tem: 'TEM', if: 'IF', genetics: 'genetika' }
    list.push({
      id: `stale-${p.id}`, type: 'stale', patientId: p.id, at: t - (idleDays(p) - STALE_DAYS) * D, to: [p.owner],
      title: `Prípad stojí ${idleDays(p)} dní`,
      text: pending.length ? `Čaká sa na: ${pending.map((k) => names[k]).join(', ')}` : 'Bez zmeny od posledného vyšetrenia',
    })
  }
  return list
}

const notifications: Notification[] = seed()
const read = new Set(notifications.filter((n) => now() - n.at > 2 * D).map((n) => n.id))
const enabled = new Set<NotifType>(NOTIF_TYPES.map((t) => t.type))

// ---------- Actions ----------

/** Unique recipients without the person who caused the event. */
export const recipients = (roles: RoleId[], actor: RoleId) => roles.filter((r, i) => r !== actor && roles.indexOf(r) === i)

export function notify(n: Omit<Notification, 'id' | 'at'>) {
  notifications.push({ ...n, id: `${n.type}-${n.patientId}-${Date.now()}`, at: now() })
  emitChange()
}

/** Called after a doctor confirms PCD during the session (F08). */
export function notifyConfirmed(p: Patient, by: RoleId) {
  notify({ type: 'conclusion', patientId: p.id, to: (['vojtech', ...LAB] as RoleId[]).filter((r) => r !== by), title: 'Záver: potvrdená PCD', text: `Autor záveru: ${ROLES[by].name} · ${ROLES[by].title}` })
  for (const n of reevalFor(p, now())) if (!notifications.some((x) => x.id === n.id)) notifications.push(n)
  emitChange()
}

export const markRead = (ids: string[]) => { ids.forEach((id) => read.add(id)); emitChange() }

export function toggleType(t: NotifType) {
  if (enabled.has(t)) enabled.delete(t)
  else enabled.add(t)
  emitChange()
}

// ---------- Reading ----------

export function useNotifications(role: RoleId) {
  useStoreVersion()
  const allowed = typesFor(role).map((t) => t.type)
  const visible = notifications
    .filter((n) => n.to.includes(role) && enabled.has(n.type) && allowed.includes(n.type))
    .sort((a, b) => b.at - a.at)
  return {
    unread: visible.filter((n) => !read.has(n.id)),
    older: visible.filter((n) => read.has(n.id)),
    enabled,
  }
}

/** F08 detail for "Prečo?": what the two patients share and what was never examined. */
export function reevalDetail(r: NonNullable<Notification['reeval']>) {
  const candidate = byId(r.candidate)
  const trigger = byId(r.trigger)
  const c = compare(candidate, trigger)
  const names = { hsvm: 'HSVM', if: 'IF', genetics: 'genetika' } as const
  const missing = (Object.keys(names) as (keyof typeof names)[])
    .filter((k) => candidate.exams[k].status === 'notDone').map((k) => names[k])
  return { candidate, trigger, shared: c.shared, different: c.different, missing }
}
