import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Activity, Check, CheckCheck, ChevronDown, CircleCheck, Clock, Dna, FileText, ImagePlus, Settings2, Share2, Sparkles, type LucideIcon } from 'lucide-react'
import { Button, IconButton, Popover, Segmented, ToggleChip, usePopover } from '../components/ui'
import { AiFeedback } from '../components/AiPanel'
import {
  NOTIF_GROUPS, markRead, now, reevalDetail, relativeTime, toggleType, typesFor, useNotifications,
  type NotifGroup, type NotifType, type Notification,
} from '../notifications'
import { useRole } from '../role'

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400'

const ICON: Record<NotifType, LucideIcon> = {
  images: ImagePlus, genetics: Dna, report: FileText, results: Activity, sharing: Share2, conclusion: CircleCheck, stale: Clock, ai: Sparkles,
}

const target = (n: Notification) => `/patients/${n.patientId}${n.tab ? `?tab=${n.tab}` : ''}`

/** Time buckets for older notifications. */
function bucket(at: number) {
  const days = (now() - at) / 86_400_000
  return days < 1 ? 'Dnes' : days < 2 ? 'Včera' : days < 7 ? 'Tento týždeň' : 'Skôr'
}

// ---------- One notification row: read ones keep the same shape, they only get quieter ----------

function NotificationRow({ n, unread, onExpand }: { n: Notification; unread: boolean; onExpand?: () => void }) {
  const navigate = useNavigate()
  const Icon = ICON[n.type]
  const ai = n.type === 'ai'
  const open = onExpand ?? (() => { if (unread) markRead([n.id]); navigate(target(n)) })
  return (
    <div onClick={open}
      className={`flex items-center gap-4 rounded-inner px-4 py-3.5 transition-shadow hover:shadow-pop cursor-pointer ${unread ? 'bg-surface' : 'bg-surface/60 hover:bg-surface'}`}>
      <span className={`relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted ${ai ? 'text-ai-600' : unread ? '' : 'text-ink-600'}`}>
        <Icon size={18} strokeWidth={1.75} />
        {unread && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ink-900 ring-2 ring-surface" />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {ai && <span className="inline-flex h-5 shrink-0 items-center rounded-full border border-ai-100 bg-ai-50 px-1.5 text-[11px] font-medium text-ai-700">AI</span>}
          <span className={unread ? 'font-semibold' : 'font-medium'}>{n.title}</span>
          <span className="shrink-0 font-mono text-xs text-ink-600">{n.patientId}</span>
        </div>
        <p className="mt-0.5 truncate text-[13px] text-ink-600">{n.text}</p>
      </div>
      <span className="num shrink-0 text-xs text-ink-400">{relativeTime(n.at)}</span>
      {onExpand && <ChevronDown size={16} aria-label="Rozbaliť" className="shrink-0 text-ink-400" />}
    </div>
  )
}

// ---------- F08: re-evaluate an excluded patient ----------

function ReevalCard({ n, unread, onCollapse }: { n: Notification; unread: boolean; onCollapse?: () => void }) {
  const navigate = useNavigate()
  const [why, setWhy] = useState(false)
  const d = reevalDetail(n.reeval!)
  const open = (to: string) => { markRead([n.id]); navigate(to) }
  return (
    <div className="rounded-inner border border-ai-100 bg-ai-50 p-4">
      <div className="flex items-start gap-4">
        <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-surface text-ai-600">
          <Sparkles size={18} />
          {unread && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-ai-600 ring-2 ring-ai-50" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-medium text-ai-700">AI · Prehodnotenie vylúčených</span>
            <span className="flex items-center gap-2">
              <span className="num text-xs text-ink-400">{relativeTime(n.at)}</span>
              {onCollapse && <button onClick={onCollapse} className="text-xs text-ink-600 hover:text-ink-900 cursor-pointer">Zbaliť</button>}
            </span>
          </div>
          <p className={`mt-1 ${unread ? 'font-semibold' : 'font-medium'}`}>{n.title}</p>
          <p className="mt-1 text-[13px] text-ink-600">{n.text}</p>
          <div className="mt-2.5 flex flex-wrap gap-1">
            {d.shared.map((s) => (
              <span key={s} className="inline-flex h-5 items-center rounded-full border border-ai-100 bg-surface px-2 text-[11px] font-medium text-ai-700">{s}</span>
            ))}
          </div>

          {why && (
            <div className="mt-3 space-y-3 rounded-inner bg-surface p-4 text-[13px] text-ink-600">
              <p>
                <b className="font-semibold text-ink-900">{d.candidate.id}</b> bol vylúčený pravdepodobne pre normálny TEM.
                Približne 30 % pacientov s PCD má normálny TEM – {d.trigger.id} je jeden z nich.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-inner bg-surface-muted p-3">
                  <p className={sectionLabel}>Spoločné s {d.trigger.id}</p>
                  <ul className="mt-2 space-y-1">{d.shared.map((s) => <li key={s} className="flex gap-2"><Check size={14} className="mt-0.5 shrink-0" />{s}</li>)}</ul>
                </div>
                <div className="rounded-inner bg-surface-muted p-3">
                  <p className={sectionLabel}>Pri vylúčení chýbalo</p>
                  {d.missing.length
                    ? <ul className="mt-2 space-y-1">{d.missing.map((s) => <li key={s} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-wait" />{s}</li>)}</ul>
                    : <p className="mt-2">Všetky vyšetrenia boli vykonané.</p>}
                </div>
              </div>
              {d.different.length > 0 && <p className="text-xs">Líši sa: {d.different.join(', ')}</p>}
              <p className="text-xs">Podobnosť je zhoda na 6 atribútoch (typ defektu TEM, pásmo nNO, laterality, RDS, srdcová vada, PCD v rodine). Rozhodnutie o prehodnotení je na ošetrujúcom lekárovi.</p>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="-ml-2"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => open(`/patients/${d.candidate.id}/similar`)}>Porovnať podobné</Button>
              <Button size="sm" variant="primary" onClick={() => open(`/patients/${d.candidate.id}`)}>Otvoriť {d.candidate.id}</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OldItem({ n }: { n: Notification }) {
  const [expanded, setExpanded] = useState(false)
  if (!n.reeval) return <NotificationRow n={n} unread={false} />
  return expanded ? <ReevalCard n={n} unread={false} onCollapse={() => setExpanded(false)} /> : <NotificationRow n={n} unread={false} onExpand={() => setExpanded(true)} />
}

// ---------- Preferences (what I receive) behind the gear ----------

function SettingsMenu() {
  const { role } = useRole()
  const { enabled } = useNotifications(role)
  const { open, setOpen, ref } = usePopover()
  return (
    <div ref={ref} className="relative">
      <IconButton aria-label="Nastavenia notifikácií" title="Nastavenia notifikácií" onClick={() => setOpen(!open)}>
        <Settings2 size={18} strokeWidth={1.75} />
      </IconButton>
      {open && (
        <Popover className="right-0 w-72 p-3">
          <p className="px-1 text-[13px] font-semibold">Dostávať notifikácie o</p>
          <div className="mt-2 flex flex-col">
            {typesFor(role).map(({ type, label }) => {
              const on = enabled.has(type)
              const Icon = ICON[type]
              return (
                <button key={type} onClick={() => toggleType(type)}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 text-left text-[13px] hover:bg-surface-muted cursor-pointer">
                  <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200'}`}>
                    {on && <Check size={11} strokeWidth={3} />}
                  </span>
                  <Icon size={15} className={type === 'ai' ? 'text-ai-600' : 'text-ink-600'} />
                  <span className={on ? '' : 'text-ink-400'}>{label}</span>
                </button>
              )
            })}
          </div>
          <p className="mt-2 border-t border-border px-1 pt-2 text-xs text-ink-600">Týka sa vašich pacientov.</p>
        </Popover>
      )}
    </div>
  )
}

// ---------- Page ----------

type View = 'all' | 'unread'

export default function Notifications() {
  const { role } = useRole()
  const { unread, older } = useNotifications(role)
  const [view, setView] = useState<View>('all')
  const [selectedGroup, setGroup] = useState<NotifGroup | null>(null)

  // Only groups this role can receive; a single group needs no filter.
  const allowed = typesFor(role).map((t) => t.type)
  const groups = NOTIF_GROUPS.filter((g) => g.types.some((t) => allowed.includes(t)))
  const filterable = groups.length > 1
  const group = filterable && groups.some((g) => g.group === selectedGroup) ? selectedGroup : null

  const inGroup = (n: Notification) => !group || NOTIF_GROUPS.find((g) => g.group === group)!.types.includes(n.type)
  const shownNew = unread.filter(inGroup)
  const shownOld = view === 'all' ? older.filter(inGroup) : []
  const buckets = [...new Set(shownOld.map((n) => bucket(n.at)))]

  return (
    <div className="mx-auto flex w-full max-w-[880px] flex-col gap-4">
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Notifikácie</h1>
        </div>
        <div className="flex items-center gap-2">
          {unread.length > 0 && <Button onClick={() => markRead(unread.map((n) => n.id))}><CheckCheck size={16} /> Označiť ako prečítané</Button>}
          <SettingsMenu />
        </div>
      </div>

      {/* Filter bar: what I see right now */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <Segmented<View> value={view} onChange={setView} options={[
          { value: 'all', label: 'Všetky' },
          { value: 'unread', label: 'Neprečítané', count: unread.length },
        ]} />
        {filterable && <span className="mx-1 h-6 w-px bg-border" />}
        {filterable && groups.map((g) => (
          <ToggleChip key={g.group} label={g.label} ai={g.group === 'ai'} active={group === g.group}
            onClick={() => setGroup(group === g.group ? null : g.group)} />
        ))}
      </div>

      {shownNew.length > 0 && (
        <section className="mt-2">
          <p className={`${sectionLabel} mb-2 px-1`}>Nové <span className="num">({shownNew.length})</span></p>
          <div className="flex flex-col gap-2">
            {shownNew.map((n) => (n.reeval ? <ReevalCard key={n.id} n={n} unread /> : <NotificationRow key={n.id} n={n} unread />))}
          </div>
        </section>
      )}

      {buckets.map((b) => (
        <section key={b} className="mt-2">
          <p className={`${sectionLabel} mb-2 px-1`}>{b}</p>
          <div className="flex flex-col gap-2">
            {shownOld.filter((n) => bucket(n.at) === b).map((n) => <OldItem key={n.id} n={n} />)}
          </div>
        </section>
      ))}

      {shownNew.length === 0 && shownOld.length === 0 && (
        <div className="mt-2 rounded-inner bg-surface px-4 py-8 text-center text-[13px] text-ink-600">
          {group || view === 'unread' ? (
            <>Pre tento filter tu nič nie je.{' '}
              <button onClick={() => { setGroup(null); setView('all') }} className="font-medium text-ink-900 underline underline-offset-2 cursor-pointer">Zrušiť filter</button>
            </>
          ) : 'Zatiaľ žiadne notifikácie.'}
        </div>
      )}
    </div>
  )
}
