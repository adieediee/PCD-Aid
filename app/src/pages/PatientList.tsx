import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowDown, ArrowRight, ArrowUp, ArrowUpRight, Clock, Ellipsis, Plus, Search, Sparkles, ThumbsDown, ThumbsUp, X,
} from 'lucide-react'
import {
  Button, ExamPill, FilterMenu, Pagination, PatientStatusPill, Tag, chipClass, usePopover, Popover,
} from '../components/ui'
import { PATIENTS, MIN_CILIA, ageOf, idleDays, isStale } from '../data/patients'
import { AddPatientModal } from '../components/Forms'
import AdvancedFilters from '../components/AdvancedFilters'
import { useStoreVersion } from '../store'
import { DEFECT_LABEL, DEFECT_SHORT, PATIENT_STATUS, ROLES } from '../labels'
import {
  CHIP_KEYS, EMPTY_FILTERS, QUEUES, ROLE_QUEUES, type QueueId,
  activeKeys, describe, idDigits, isIdQuery, matches, type FilterKey, type Filters,
} from '../filters'
import { EXAMPLE_QUERIES, parseQuery, type ParseResult } from '../ai/parseQuery'
import { useRole } from '../role'
import type { Anamnesis, ExamStatus, Patient, PatientStatus, TemDefect } from '../types'

type SortKey = 'id' | 'status' | 'anamnesis' | 'picadar' | 'nno' | 'hsvm' | 'tem' | 'if' | 'genetics' | 'lastActivity'
type ExamKey = 'hsvm' | 'tem' | 'if' | 'genetics'

// Group order when sorting by a status column: workflow order for patients, most telling result first for exams.
const STATUS_RANK: Record<PatientStatus, number> = { diagnostics: 0, unclear: 1, confirmed: 2, excluded: 3 }
const EXAM_RANK: Record<ExamStatus, number> = { abnormal: 0, pending: 1, normal: 2, notDone: 3 }

const PAGE_SIZE = 15
const ROW_HEIGHT = 56 // h-14
const TABLE_HEADER_HEIGHT = 56 // header row + its top margin

const anamnesisCount = (p: Patient) => {
  const a = p.anamnesis
  if (!a) return -1
  return [a.situs !== 'solitus', a.neonatalRds, a.heartDefect, a.familyPcd].filter(Boolean).length
}

const STATUS_OPTIONS = (Object.keys(PATIENT_STATUS) as PatientStatus[]).map((s) => ({ value: s, label: PATIENT_STATUS[s].label }))
const DEFECT_OPTIONS = (Object.keys(DEFECT_LABEL) as TemDefect[]).map((d) => ({ value: d, label: DEFECT_LABEL[d] }))

function relative(days: number) {
  if (days === 0) return 'dnes'
  if (days === 1) return 'včera'
  if (days < 30) return `pred ${days} d`
  if (days < 365) return `pred ${Math.round(days / 30)} mes.`
  return `pred ${Math.round(days / 365)} r.`
}

function temText(p: Patient) {
  const t = p.exams.tem
  if (t.status === 'pending' && t.ciliaCount != null) return `${t.ciliaCount}/${MIN_CILIA}`
  return t.defect ? DEFECT_SHORT[t.defect] : undefined
}

function geneticsText(p: Patient) {
  const g = p.exams.genetics
  if (g.status === 'abnormal') return g.gene ?? undefined
  if (g.status === 'normal') return 'negat.'
  return undefined
}

// ---------- Stat cards ----------

function StatCard({
  label, value, footer, hero, active, onClick,
}: { label: string; value: number; footer: ReactNode; hero?: boolean; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col rounded-card p-5 text-left transition-shadow cursor-pointer ${
        hero ? 'bg-ink-900 text-white' : 'bg-surface'
      } ${active ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-canvas' : ''}`}
    >
      <div className="flex items-start justify-between">
        <span className={`text-[15px] font-medium ${hero ? 'text-white/80' : 'text-ink-600'}`}>{label}</span>
        <span className={`flex size-8 items-center justify-center rounded-full border transition-colors ${
          hero ? 'border-white/30 group-hover:bg-white group-hover:text-ink-900' : 'border-border group-hover:bg-ink-900 group-hover:text-white'
        }`}>
          <ArrowUpRight size={16} />
        </span>
      </div>
      <span className="num mt-3 text-[40px] leading-none font-normal tracking-[-0.02em]">{value}</span>
      <span className={`mt-3 text-xs ${hero ? 'text-white/70' : 'text-ink-600'}`}>{footer}</span>
    </button>
  )
}

// ---------- AI sentence search (F02) ----------

function AiInterpretation({ result, onClear }: { result: ParseResult; onClear: () => void }) {
  const [why, setWhy] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)

  return (
    <div className="rounded-card border border-ai-100 bg-ai-50 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-ai-700">
            <Sparkles size={16} /> Rozumiem tomu takto
          </div>
          <p className="mt-1 text-[13px] text-ink-600">„{result.query}“</p>
        </div>
        <Button size="sm" variant="ghost" onClick={onClear}><X size={14} /> Zrušiť</Button>
      </div>

      {result.matches.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-2">
          {result.matches.map((m, i) => (
            <span key={i} className="inline-flex h-8 items-center gap-2 rounded-full border border-ai-100 bg-surface px-3 text-[13px]">
              <span className="text-ink-600">„{m.phrase}“</span>
              <ArrowRight size={14} className="text-ai-600" />
              <span className="font-medium text-ai-700">
                {(Object.keys(m.patch) as FilterKey[]).map((k) => describe(k, { ...EMPTY_FILTERS, ...m.patch })).join(', ')}
              </span>
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-ink-900">
          Vetu sa nepodarilo preložiť na filtre. Skús napr. „deti s nízkym nNO a normálnym TEM“.
        </p>
      )}

      {result.unknown.length > 0 && (
        <p className="mt-3 text-xs text-ink-600">
          Nerozpoznané slová (ignorované): {result.unknown.map((w) => `„${w}“`).join(', ')}
        </p>
      )}

      {why && (
        <div className="mt-4 rounded-inner bg-surface p-4 text-[13px] leading-relaxed text-ink-600">
          Filtre sú odvodené z kľúčových slov vo vete (napr. „nízke nNO“ = hodnota pod 180 ppb).
          Výsledky ďalej nijako neupravujem ani nezoraďujem – v tabuľke sú presne tí pacienti, ktorí spĺňajú
          <b className="font-semibold text-ink-900"> všetky </b>filtre naraz. Každý filter môžeš zrušiť alebo zmeniť ručne.
        </div>
      )}

      <div className="mt-4 flex items-center gap-1 text-ink-600">
        <Button size="sm" variant="ghost" onClick={() => setWhy(!why)} className="text-ai-700 hover:text-ai-700">
          {why ? 'Skryť vysvetlenie' : 'Prečo?'}
        </Button>
        <button aria-label="Užitočné" onClick={() => setFeedback('up')}
          className={`flex size-8 items-center justify-center rounded-full hover:bg-surface cursor-pointer ${feedback === 'up' ? 'text-ai-700' : ''}`}>
          <ThumbsUp size={15} />
        </button>
        <button aria-label="Neužitočné" onClick={() => setFeedback('down')}
          className={`flex size-8 items-center justify-center rounded-full hover:bg-surface cursor-pointer ${feedback === 'down' ? 'text-ai-700' : ''}`}>
          <ThumbsDown size={15} />
        </button>
        {feedback && <span className="ml-1 text-xs">Ďakujem za spätnú väzbu</span>}
      </div>
    </div>
  )
}

function Thinking() {
  return (
    <div className="flex items-center gap-2 rounded-card border border-ai-100 bg-ai-50 p-5 text-[15px] font-medium text-ai-700">
      <Sparkles size={16} className="animate-pulse" /> <span className="animate-pulse">Premýšľam…</span>
    </div>
  )
}

function SearchBox({
  value, onChange, onAsk,
}: { value: string; onChange: (v: string) => void; onAsk: (q: string) => void }) {
  const { open, setOpen, ref } = usePopover()
  const sentence = value.trim().length > 0 && !isIdQuery(value)

  return (
    <div ref={ref} className="relative w-[440px]">
      <div className={`flex h-10 items-center gap-2.5 rounded-full px-4 transition-colors ${sentence ? 'bg-ai-50 ring-1 ring-ai-100' : 'bg-surface-muted'}`}>
        {sentence ? <Sparkles size={18} className="text-ai-600" /> : <Search size={18} className="text-ink-400" />}
        <input
          value={value}
          onFocus={() => setOpen(true)}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && sentence) { onAsk(value.trim()); setOpen(false) } }}
          placeholder="Hľadať ID alebo napísať otázku vetou…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
        {sentence && <span className="text-xs font-medium whitespace-nowrap text-ai-700">Enter ↵</span>}
        {value && !sentence && (
          <button aria-label="Vymazať" onClick={() => onChange('')} className="text-ink-400 hover:text-ink-900 cursor-pointer"><X size={16} /></button>
        )}
      </div>
      {open && !value && (
        <Popover className="right-0 w-full">
          <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ai-700">
            <Sparkles size={12} /> Skús sa opýtať vetou
          </p>
          {EXAMPLE_QUERIES.map((q) => (
            <button key={q} onClick={() => { onChange(q); onAsk(q); setOpen(false) }}
              className="flex w-full rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-ai-50 cursor-pointer">
              {q}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}

// ---------- Table ----------

function SortHeader({ label, k, sort, onSort, className = '' }: {
  label: string; k: SortKey; sort: { key: SortKey; dir: 1 | -1 }; onSort: (k: SortKey) => void; className?: string
}) {
  const active = sort.key === k
  return (
    <th className={`px-3 font-semibold ${className}`}>
      <button onClick={() => onSort(k)} className={`inline-flex items-center gap-1 uppercase cursor-pointer ${active ? 'text-ink-900' : 'hover:text-ink-900'}`}>
        {label}
        {active && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
    </th>
  )
}

const ANAMNESIS_TAGS: { short: string; full: string; on: (a: Anamnesis) => boolean }[] = [
  { short: 'Situs', full: 'Porucha laterality', on: (a) => a.situs !== 'solitus' },
  { short: 'RDS', full: 'RDS novorodenca', on: (a) => a.neonatalRds },
  { short: 'Srdce', full: 'Srdcová vada', on: (a) => a.heartDefect },
  { short: 'Rodina', full: 'PCD v rodine', on: (a) => a.familyPcd },
]
const MAX_TAGS = 2 // + a "+N" tag still fits the fixed column width

function AnamnesisTags({ p }: { p: Patient }) {
  const a = p.anamnesis
  // Fixed width + one line, so rows keep the same height and the column never grows; the rest goes into "+N" (full list on hover).
  const box = 'flex w-[136px] flex-nowrap items-center gap-1 overflow-hidden'
  if (!a) return <div className={box}><span className="text-xs text-ink-400">nevyplnená</span></div>
  const tags = ANAMNESIS_TAGS.filter((t) => t.on(a))
  if (!tags.length) return <div className={box}><span className="text-ink-400">—</span></div>
  const shown = tags.slice(0, MAX_TAGS)
  return (
    <div className={box} title={tags.map((t) => t.full).join(', ')}>
      {shown.map((t) => <Tag key={t.short}>{t.short}</Tag>)}
      {shown.length < tags.length && <Tag>+{tags.length - shown.length}</Tag>}
    </div>
  )
}

function RowMenu({ id }: { id: string }) {
  const { open, setOpen, ref } = usePopover()
  const navigate = useNavigate()
  const actions: { label: string; to?: string; ai?: boolean }[] = [
    { label: 'Otvoriť profil', to: `/patients/${id}` },
    { label: 'Zdieľať prípad' },
    { label: 'Nájsť podobných pacientov', to: `/patients/${id}?ai=similar`, ai: true },
  ]
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button aria-label="Akcie" onClick={() => setOpen(!open)} className="flex size-8 items-center justify-center rounded-full text-ink-400 hover:bg-surface hover:text-ink-900 cursor-pointer">
        <Ellipsis size={18} />
      </button>
      {open && (
        <Popover className="right-0 w-52">
          {actions.map((a) => (
            <button key={a.label} onClick={() => { setOpen(false); if (a.to) navigate(a.to) }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] cursor-pointer ${a.ai ? 'text-ai-700 hover:bg-ai-50' : 'hover:bg-surface-muted'}`}>
              {a.ai && <Sparkles size={14} />}
              {a.label}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}

// ---------- Page ----------

export default function PatientList() {
  const navigate = useNavigate()
  const { role } = useRole()
  const [params, setParams] = useSearchParams()
  // Clinicians own cases ("Moji"); the lab works on cases shared with them.

  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS)
  const [aiKeys, setAiKeys] = useState<FilterKey[]>([])
  const [aiResult, setAiResult] = useState<ParseResult | null>(null)
  const [thinking, setThinking] = useState(false)
  const [input, setInput] = useState('')
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'lastActivity', dir: 1 })
  const [adding, setAdding] = useState(false)
  const [added, setAdded] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const version = useStoreVersion()

  // Manual change of a filter takes it out of AI ownership.
  const setFilter = <K extends FilterKey>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value }))
    setAiKeys((keys) => keys.filter((k) => k !== key))
  }

  const clearAi = () => {
    setFilters((f) => {
      const next = { ...f }
      for (const k of aiKeys) (next as Record<string, unknown>)[k] = EMPTY_FILTERS[k]
      return next
    })
    setAiKeys([])
    setAiResult(null)
    setInput('')
  }

  const clearAll = () => { setFilters(EMPTY_FILTERS); setAiKeys([]); setAiResult(null); setInput('') }

  const ask = (q: string) => {
    setThinking(true)
    setAiResult(null)
    // Short artificial delay so it feels like AI (Wizard of Oz).
    setTimeout(() => {
      const result = parseQuery(q)
      setFilters((f) => {
        const next = { ...f }
        for (const k of aiKeys) (next as Record<string, unknown>)[k] = EMPTY_FILTERS[k]
        return { ...next, ...result.filters }
      })
      setAiKeys(Object.keys(result.filters) as FilterKey[])
      setAiResult(result)
      setThinking(false)
    }, 700)
  }

  const rows = useMemo(() => {
    const idQuery = isIdQuery(input) ? idDigits(input) : null
    const list = PATIENTS.filter((p) => matches(p, filters) && (!idQuery || p.id.includes(idQuery)))
    // Exam columns group by status first, then by the value shown in the pill (defect, gene…).
    const exam = (p: Patient, k: ExamKey, detail = ''): (number | string)[] => [EXAM_RANK[p.exams[k].status], detail]
    const val = (p: Patient): (number | string)[] => {
      switch (sort.key) {
        case 'id': return [p.id]
        case 'status': return [STATUS_RANK[p.status]]
        case 'anamnesis': return [-anamnesisCount(p)]
        case 'picadar': return [p.picadar ?? -1]
        case 'nno': return [p.exams.nno.value ?? 9999]
        case 'hsvm': return exam(p, 'hsvm')
        case 'tem': return exam(p, 'tem', temText(p) ?? '')
        case 'if': return exam(p, 'if')
        case 'genetics': return exam(p, 'genetics', geneticsText(p) ?? '')
        case 'lastActivity': return [idleDays(p)]
      }
    }
    const cmp = (a: Patient, b: Patient) => {
      const va = val(a), vb = val(b)
      for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return va[i] > vb[i] ? 1 : -1
      return 0
    }
    return [...list].sort((a, b) => cmp(a, b) * sort.dir)
  }, [version, filters, input, sort])

  // Any change of the result set (filter, sort, search) starts from the first page.
  useEffect(() => setPage(1), [rows])
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  // Query handed over from the top bar search (?q=…): ID → filter, sentence → F02.
  const handedQuery = params.get('q')
  useEffect(() => {
    if (!handedQuery) return
    setInput(handedQuery)
    if (!isIdQuery(handedQuery)) ask(handedQuery)
    setParams({}, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handedQuery])

  const onSort = (k: SortKey) => setSort((s) => (s.key === k ? { key: k, dir: s.dir === 1 ? -1 : 1 } : { key: k, dir: 1 }))

  const openQueue = (q: QueueId) => {
    setFilter('queue', filters.queue === q ? null : q)
  }

  const hasFilters = activeKeys(filters).length > 0 || input.trim() !== ''
  const chipActive = activeKeys(filters).filter((k) => CHIP_KEYS.includes(k) || k === 'queue')
  const facet = <K extends FilterKey>(key: K, value: Filters[K]) => PATIENTS.filter((p) => matches(p, { ...filters, [key]: value })).length
  const ai = (k: FilterKey) => aiKeys.includes(k)

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-end justify-between px-1 pt-2">
        <div>
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Pacienti</h1>
          <p className="mt-1 text-ink-600">Prehľad pacientov a stavu ich vyšetrení na jednom mieste.</p>
        </div>
        {role === 'vojtech' && <Button variant="primary" onClick={() => setAdding(true)}><Plus size={18} /> Pridať pacienta</Button>}
      </div>

      {/* My work – role-based queues; click = show the queue across all patients */}
      <div>
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">Moja práca · {ROLES[role].name}</p>
        <div className="grid grid-cols-4 gap-4">
          {ROLE_QUEUES[role].map((q, i) => (
            <StatCard key={q} hero={i === 0} label={QUEUES[q].label} value={PATIENTS.filter(QUEUES[q].test).length} footer={QUEUES[q].hint}
              active={filters.queue === q} onClick={() => openQueue(q)} />
          ))}
        </div>
      </div>

      {/* List card */}
      <div className="rounded-card bg-surface p-6">
        {/* Search + filters */}
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox value={input} onAsk={ask} onChange={(v) => { setInput(v); if (!v) setAiResult(null) }} />
          <FilterMenu label="Stav" multi options={STATUS_OPTIONS} selected={filters.statuses} ai={ai('statuses')}
            onChange={(v) => setFilter('statuses', v)} count={(v) => facet('statuses', [v])} />
          <FilterMenu label="Typ defektu" multi options={DEFECT_OPTIONS} selected={filters.defects} ai={ai('defects')}
            onChange={(v) => setFilter('defects', v)} count={(v) => facet('defects', [v])} />
          <AdvancedFilters patients={PATIENTS} filters={filters} onChange={setFilter} resultCount={rows.length} />
          {/* Active filters without their own control, as removable chips – in the same row, after the controls,
              so the buttons (and the open popover) stay put and no extra row pushes the table down. */}
          {chipActive.length > 0 && <span className="mx-1 h-5 border-l border-border" />}
          {chipActive.map((k) => (
            <button key={k} className={chipClass(true, ai(k))} onClick={() => setFilter(k, EMPTY_FILTERS[k])}>
              {ai(k) && <Sparkles size={14} />} {describe(k, filters)} <X size={14} className="opacity-70" />
            </button>
          ))}
          {hasFilters && (
            <Button size="sm" variant="ghost" onClick={clearAll}>Zrušiť všetko</Button>
          )}
        </div>

        {(thinking || aiResult) && (
          <div className="mt-4">
            {thinking ? <Thinking /> : aiResult && <AiInterpretation result={aiResult} onClear={clearAi} />}
          </div>
        )}


        {/* Table */}
        {rows.length > 0 ? (
          // With several pages, keep a full page of height so the pagination doesn't jump on the last, shorter page.
          <div style={pageCount > 1 ? { minHeight: TABLE_HEADER_HEIGHT + PAGE_SIZE * ROW_HEIGHT } : undefined}>
          <table className="mt-4 w-full border-separate border-spacing-0 text-left">
            <thead>
              <tr className="text-[11px] tracking-[0.06em] text-ink-400 [&>th]:h-10 [&>th]:border-b [&>th]:border-border">
                <SortHeader label="Pacient" k="id" sort={sort} onSort={onSort} />
                <SortHeader label="Stav" k="status" sort={sort} onSort={onSort} />
                <SortHeader label="Anamnéza" k="anamnesis" sort={sort} onSort={onSort} />
                <SortHeader label="PICADAR" k="picadar" sort={sort} onSort={onSort} />
                <SortHeader label="nNO" k="nno" sort={sort} onSort={onSort} />
                <SortHeader label="HSVM" k="hsvm" sort={sort} onSort={onSort} />
                <SortHeader label="TEM" k="tem" sort={sort} onSort={onSort} />
                <SortHeader label="IF" k="if" sort={sort} onSort={onSort} />
                <SortHeader label="Genetika" k="genetics" sort={sort} onSort={onSort} />
                <SortHeader label="Posledná zmena" k="lastActivity" sort={sort} onSort={onSort} />
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((p) => {
                const idle = idleDays(p)
                const stale = isStale(p)
                return (
                  <tr key={p.id} onClick={() => navigate(`/patients/${p.id}`)}
                    className="group cursor-pointer [&>td]:h-14 [&>td]:border-b [&>td]:border-border [&>td]:px-3 hover:[&>td]:bg-surface-muted [&>td:first-child]:rounded-l-inner [&>td:last-child]:rounded-r-inner">
                    <td>
                      <div className="font-mono text-[13px] font-semibold">{p.id}</div>
                      <div className="num text-xs text-ink-600">odber {p.sampleNo} · nar. {p.birthYear} · {ageOf(p)} r.</div>
                    </td>
                    <td><PatientStatusPill status={p.status} /></td>
                    <td><AnamnesisTags p={p} /></td>
                    <td>
                      {p.picadar != null
                        ? <span className="num"><span className="font-medium">{p.picadar}</span><span className="text-xs text-ink-400">/14</span></span>
                        : <span title="Nevyplnené" className="hatch inline-block h-6 w-10 rounded-full" />}
                    </td>
                    <td><ExamPill status={p.exams.nno.status} text={p.exams.nno.value != null ? String(p.exams.nno.value) : undefined} /></td>
                    <td><ExamPill status={p.exams.hsvm.status} /></td>
                    <td><ExamPill status={p.exams.tem.status} text={temText(p)} /></td>
                    <td><ExamPill status={p.exams.if.status} /></td>
                    <td><ExamPill status={p.exams.genetics.status} text={geneticsText(p)} /></td>
                    <td className="whitespace-nowrap text-[13px]">
                      {stale
                        ? <span className="inline-flex items-center gap-1 font-medium text-wait"><Clock size={13} /> {idle} d bez zmeny</span>
                        : <span className="text-ink-600">{relative(idle)}</span>}
                    </td>
                    <td><RowMenu id={p.id} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        ) : (
          <div className="mt-4 flex flex-col items-center rounded-inner bg-surface-muted py-14 text-center">
            <p className="text-[15px] font-semibold">Žiadny pacient nezodpovedá filtrom</p>
            <p className="mt-1 text-ink-600">Skús niektorý filter zrušiť.</p>
            <div className="mt-4 flex gap-2">
              <Button size="sm" onClick={clearAll}>Zrušiť filtre</Button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-ink-600">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-ok" /> V norme</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-bad" /> Mimo normy</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-wait" /> Čaká sa</span>
          <span className="flex items-center gap-1.5"><span className="hatch inline-block h-3 w-5 rounded-full" /> Nevykonané</span>
          {pageCount > 1 && <Pagination className="ml-auto" page={currentPage} pageCount={pageCount} pageSize={PAGE_SIZE} total={rows.length} onChange={setPage} />}
        </div>
      </div>
      {adding && (
        <AddPatientModal onClose={() => setAdding(false)}
          onAdded={(id) => { setAdding(false); setAdded(id); setTimeout(() => setAdded(null), 5000) }} />
      )}
      {added && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-ink-900 py-1.5 pr-1.5 pl-5 text-[13px] text-white shadow-pop">
          Pacient <span className="font-mono">{added}</span> bol pridaný
          <button onClick={() => navigate(`/patients/${added}`)} className="h-8 rounded-full bg-white px-4 font-medium text-ink-900 cursor-pointer">Otvoriť profil</button>
        </div>
      )}
    </div>
  )
}
