import { Check, SlidersHorizontal } from 'lucide-react'
import { Button, CountSlot, Popover, chipClass, usePopover } from './ui'
import {
  ADVANCED_KEYS, AGE_AT_DX_OPTIONS, AGE_OPTIONS, EMPTY_FILTERS, FLAG_FILTERS, PICADAR_OPTIONS,
  activeKeys, matches, type FilterKey, type Filters,
} from '../filters'
import { NNO_THRESHOLD } from '../data/patients'
import type { Patient } from '../types'

// "Ďalšie filtre": attributes for finding similar / research cases (Lucia, Dominika). One short column.

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400'
const NNO_SHORT = [{ value: 'low', label: `< ${NNO_THRESHOLD}` }, { value: 'normal', label: `≥ ${NNO_THRESHOLD}` }] as const
const PICADAR_SHORT = PICADAR_OPTIONS.map((o) => ({ ...o, label: o.label.replace(' bodov', '') }))
const AGE_SHORT = AGE_OPTIONS.map((o) => ({ ...o, label: o.label.replace(/ \(.*\)/, '') }))
const AGE_AT_DX_SHORT = AGE_AT_DX_OPTIONS.map((o) => ({ ...o, label: o.label.replace(' rokov', '') }))
const SIBLING_SHORT = [{ value: 'none', label: '0' }, { value: 'some', label: '1+' }] as const

function CheckRow({ label, on, count, onClick }: { label: string; on: boolean; count: number; onClick: () => void }) {
  const empty = count === 0 && !on
  return (
    <button onClick={onClick} disabled={empty}
      className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left text-[13px] ${empty ? 'text-ink-400' : 'hover:bg-surface-muted cursor-pointer'}`}>
      <span className={`flex size-4 shrink-0 items-center justify-center rounded border ${on ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200'}`}>
        {on && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="flex-1">{label}</span>
      <span className="num text-xs text-ink-400">{count}</span>
    </button>
  )
}

/** Small single-choice switch; clicking the active option clears it. */
function Switch({ label, unit, options, value, onPick }: {
  label: string; unit?: string; options: readonly { value: string; label: string }[]; value: string | null; onPick: (v: string | null) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-2 py-1.5">
      <span className="text-[13px]">{label}{unit && <span className="ml-1 text-xs text-ink-400">{unit}</span>}</span>
      <div className="inline-flex rounded-full bg-surface-muted p-0.5">
        {options.map((o) => (
          <button key={o.value} onClick={() => onPick(value === o.value ? null : o.value)}
            className={`num h-7 min-w-10 rounded-full px-2.5 text-xs font-medium whitespace-nowrap cursor-pointer ${
              value === o.value ? 'bg-ink-900 text-white' : 'text-ink-600 hover:text-ink-900'
            }`}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function AdvancedFilters({ patients, filters, onChange, resultCount }: {
  patients: Patient[]
  filters: Filters
  onChange: <K extends FilterKey>(key: K, value: Filters[K]) => void
  resultCount: number
}) {
  const { open, setOpen, ref } = usePopover()
  const active = activeKeys(filters).filter((k) => ADVANCED_KEYS.includes(k)).length
  const count = <K extends FilterKey>(key: K, value: Filters[K]) => patients.filter((p) => matches(p, { ...filters, [key]: value })).length
  const pick = <K extends FilterKey>(key: K) => (v: string | null) => onChange(key, v as Filters[K])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)} className={`${chipClass(active > 0, false)} pr-2.5`}>
        <SlidersHorizontal size={14} /> Ďalšie filtre
        <CountSlot n={active} />
      </button>

      {open && (
        <Popover className="right-0 w-[360px] p-0">
          <div className="p-4">
            <p className={`${sectionLabel} mb-1 px-2`}>Anamnéza</p>
            {FLAG_FILTERS.map((f) => (
              <CheckRow key={f.key} label={f.label} on={filters[f.key]} count={count(f.key, true)} onClick={() => onChange(f.key, !filters[f.key])} />
            ))}
            <p className={`${sectionLabel} mt-4 mb-1 px-2`}>Výsledky a pacient</p>
            <Switch label="nNO" unit="ppb" options={NNO_SHORT} value={filters.nno} onPick={pick('nno')} />
            <Switch label="PICADAR" options={PICADAR_SHORT} value={filters.picadar} onPick={pick('picadar')} />
            <Switch label="Vek" options={AGE_SHORT} value={filters.age} onPick={pick('age')} />
            <Switch label="Vek pri diagnóze" options={AGE_AT_DX_SHORT} value={filters.ageAtDx} onPick={pick('ageAtDx')} />
            <Switch label="Súrodenci" options={SIBLING_SHORT} value={filters.siblings} onPick={pick('siblings')} />
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <Button size="sm" variant="ghost" onClick={() => ADVANCED_KEYS.forEach((k) => onChange(k, EMPTY_FILTERS[k]))}
              disabled={!active} className="disabled:opacity-40">Zrušiť</Button>
            <Button size="sm" variant="primary" onClick={() => setOpen(false)}>Zobraziť {resultCount} {resultCount === 1 ? 'pacienta' : 'pacientov'}</Button>
          </div>
        </Popover>
      )}
    </div>
  )
}
