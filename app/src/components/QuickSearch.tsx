import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeft, History, Search, Sparkles, X } from 'lucide-react'
import { Kbd, PatientStatusPill, Popover, usePopover } from './ui'
import { PATIENTS, ageOf } from '../data/patients'
import { DEFECT_LABEL, PATIENT_STATUS } from '../labels'
import { idDigits, isIdQuery } from '../filters'
import { recentPatients, useStoreVersion } from '../store'
import type { Patient } from '../types'

// Top bar search: jump to a patient by ID, gene, TEM finding or status; anything else goes to F02 in the list.

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

const searchText = (p: Patient) =>
  fold([p.id, p.exams.genetics.gene, p.exams.tem.defect && DEFECT_LABEL[p.exams.tem.defect], PATIENT_STATUS[p.status].label].filter(Boolean).join(' '))

const subtitle = (p: Patient) =>
  [`odber ${p.sampleNo}`, `${ageOf(p)} r.`, p.exams.tem.defect && DEFECT_LABEL[p.exams.tem.defect], p.exams.genetics.gene].filter(Boolean).join(' · ')

type Option = { kind: 'patient'; patient: Patient } | { kind: 'ask'; query: string }

export default function QuickSearch() {
  const navigate = useNavigate()
  useStoreVersion()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const { open, setOpen, ref } = usePopover()
  const inputRef = useRef<HTMLInputElement>(null)

  // Ctrl+K / ⌘K focuses the search from anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        inputRef.current?.select()
        setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [setOpen])

  const query = q.trim()
  const idQuery = isIdQuery(query)

  const options: Option[] = useMemo(() => {
    if (!query) return recentPatients().map((id) => PATIENTS.find((p) => p.id === id)).filter(Boolean).map((p) => ({ kind: 'patient' as const, patient: p! }))
    const words = fold(query).split(/\s+/)
    const patients = idQuery
      ? PATIENTS.filter((p) => p.id.includes(idDigits(query)))
      : PATIENTS.filter((p) => words.every((w) => searchText(p).includes(w)))
    const list: Option[] = patients.slice(0, 6).map((p) => ({ kind: 'patient', patient: p }))
    if (!idQuery) list.push({ kind: 'ask', query })
    return list
  }, [query, idQuery])

  useEffect(() => setActive(0), [query])

  const close = () => { setQ(''); setOpen(false); inputRef.current?.blur() }
  const choose = (o: Option) => {
    if (o.kind === 'patient') navigate(`/patients/${o.patient.id}`)
    else navigate(`/patients?tab=all&q=${encodeURIComponent(o.query)}`)
    close()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, options.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter' && options[active]) choose(options[active])
    else if (e.key === 'Escape') close()
  }

  const patientCount = options.filter((o) => o.kind === 'patient').length

  return (
    <div ref={ref} className="relative w-[420px]">
      <div className="flex h-10 items-center gap-2.5 rounded-full bg-surface-muted px-4 focus-within:ring-2 focus-within:ring-ink-200">
        <Search size={18} className="text-ink-400" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Hľadať pacienta – ID, gén, nález…"
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
        {q
          ? <button aria-label="Vymazať" onClick={() => { setQ(''); inputRef.current?.focus() }} className="text-ink-400 hover:text-ink-900 cursor-pointer"><X size={16} /></button>
          : <Kbd>{IS_MAC ? '⌘K' : 'Ctrl K'}</Kbd>}
      </div>

      {open && (options.length > 0 || query) && (
        <Popover className="w-full">
          {!query && <p className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400"><History size={12} /> Naposledy otvorení</p>}
          {query && patientCount === 0 && idQuery && <p className="px-2.5 py-2 text-[13px] text-ink-600">Pacient s ID {query} neexistuje.</p>}
          {query && patientCount === 0 && !idQuery && <p className="px-2.5 pt-2 pb-1 text-[13px] text-ink-600">Žiadny pacient nezodpovedá „{query}“.</p>}

          {options.map((o, i) => o.kind === 'patient' ? (
            <button key={o.patient.id} onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left cursor-pointer ${i === active ? 'bg-surface-muted' : ''}`}>
              <div className="min-w-0 flex-1">
                <span className="font-mono text-[13px] font-semibold">{o.patient.id}</span>
                <p className="num truncate text-xs text-ink-600">{subtitle(o.patient)}</p>
              </div>
              <PatientStatusPill status={o.patient.status} />
            </button>
          ) : (
            <button key="ask" onMouseEnter={() => setActive(i)} onClick={() => choose(o)}
              className={`mt-1 flex w-full items-center gap-2.5 rounded-lg border-t border-border px-2.5 py-2.5 text-left text-[13px] cursor-pointer ${i === active ? 'bg-ai-50' : ''}`}>
              <Sparkles size={15} className="shrink-0 text-ai-600" />
              <span className="min-w-0 flex-1 truncate">Hľadať vetou v zozname: <span className="font-medium text-ai-700">„{o.query}“</span></span>
              {i === active && <CornerDownLeft size={14} className="shrink-0 text-ink-400" />}
            </button>
          ))}
        </Popover>
      )}
    </div>
  )
}
