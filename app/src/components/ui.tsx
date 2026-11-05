import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, Sparkles, X } from 'lucide-react'
import { EXAM_STATUS, PATIENT_STATUS } from '../labels'
import type { ExamStatus, PatientStatus } from '../types'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'ai' | 'aiSoft'

const BUTTON: Record<ButtonVariant, string> = {
  primary: 'bg-ink-900 text-white hover:bg-ink-900/90',
  secondary: 'bg-surface text-ink-900 border border-border hover:bg-surface-muted',
  ghost: 'text-ink-600 hover:bg-surface-muted hover:text-ink-900',
  ai: 'bg-ai-600 text-white hover:bg-ai-700',
  aiSoft: 'border border-ai-100 bg-ai-50 text-ai-700 hover:bg-ai-100',
}

export function Button({
  variant = 'secondary', size = 'md', className, children, ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' }) {
  return (
    <button
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-medium transition-colors cursor-pointer',
        size === 'md' ? 'h-10 px-5 text-sm' : 'h-8 px-3.5 text-[13px]',
        BUTTON[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function IconButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cx(
        'relative inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface text-ink-900 transition-colors hover:bg-surface-muted cursor-pointer',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-card bg-surface p-6', className)}>{children}</div>
}

/** Centered dialog over a dimmed canvas. Escape or backdrop click closes it. */
export function Modal({ title, subtitle, onClose, width = 'max-w-lg', children }: {
  title: string; subtitle?: string; onClose: () => void; width?: string; children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink-900/30 p-4 pt-[10vh]" onMouseDown={onClose}>
      <div className={cx('w-full rounded-card bg-surface p-6 shadow-pop', width)} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">{title}</h2>
            {subtitle && <p className="mt-1 text-[13px] text-ink-600">{subtitle}</p>}
          </div>
          <button aria-label="Zavrieť" onClick={onClose} className="-mt-1 -mr-1 flex size-8 items-center justify-center rounded-full text-ink-600 hover:bg-surface-muted cursor-pointer">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Labelled form field with an inline validation message. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="mt-1.5">{children}</div>
      {error ? <span className="mt-1 block text-xs text-bad">{error}</span> : hint && <span className="mt-1 block text-xs text-ink-600">{hint}</span>}
    </label>
  )
}

export const inputClass = (error?: string) =>
  cx('h-10 w-full rounded-full bg-surface-muted px-4 text-sm outline-none placeholder:text-ink-400 focus:ring-2',
    error ? 'ring-2 ring-bad/40 focus:ring-bad/40' : 'focus:ring-ink-200')

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-sans text-[11px] text-ink-600">
      {children}
    </kbd>
  )
}

/** Exam status pill: tinted background + dot + short value. Not-done exams are hatched. */
export function ExamPill({ status, text }: { status: ExamStatus; text?: string }) {
  const s = EXAM_STATUS[status]
  if (status === 'notDone') {
    return <span title={s.label} className="hatch inline-block h-6 w-12 rounded-full" />
  }
  const fallback = status === 'pending' ? 'čaká' : status === 'normal' ? 'v norme' : 'mimo'
  return (
    <span title={s.label} className={cx('num inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full px-2 text-xs font-medium', s.pill)}>
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {text ?? fallback}
    </span>
  )
}

export function PatientStatusPill({ status }: { status: PatientStatus }) {
  const s = PATIENT_STATUS[status]
  return (
    <span className={cx(
      'inline-flex h-6 items-center gap-1.5 whitespace-nowrap rounded-full border border-border px-2.5 text-xs font-medium',
      status === 'excluded' ? 'text-ink-400' : 'text-ink-900',
    )}>
      <span className={cx('size-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center whitespace-nowrap rounded-full border border-border px-2 text-[11px] font-medium text-ink-600">
      {children}
    </span>
  )
}

export function Pagination({ page, pageCount, pageSize, total, onChange, className }: {
  page: number; pageCount: number; pageSize: number; total: number; onChange: (page: number) => void; className?: string
}) {
  const pageButton = 'flex size-8 items-center justify-center rounded-full text-[13px] font-medium transition-colors cursor-pointer disabled:cursor-default disabled:text-ink-400 disabled:hover:bg-transparent'
  return (
    <nav aria-label="Stránkovanie" className={cx('flex items-center gap-1', className)}>
      <span className="num mr-2 text-xs text-ink-600">{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} z {total}</span>
      <button aria-label="Predchádzajúca strana" disabled={page === 1} onClick={() => onChange(page - 1)} className={cx(pageButton, 'text-ink-900 hover:bg-surface-muted')}>
        <ChevronLeft size={16} />
      </button>
      {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
        <button key={n} aria-current={n === page ? 'page' : undefined} onClick={() => onChange(n)}
          className={cx(pageButton, 'num', n === page ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-surface-muted hover:text-ink-900')}>
          {n}
        </button>
      ))}
      <button aria-label="Ďalšia strana" disabled={page === pageCount} onClick={() => onChange(page + 1)} className={cx(pageButton, 'text-ink-900 hover:bg-surface-muted')}>
        <ChevronRight size={16} />
      </button>
    </nav>
  )
}

export function Segmented<V extends string>({
  value, options, onChange,
}: { value: V; options: { value: V; label: string; count?: number; dot?: string }[]; onChange: (v: V) => void }) {
  return (
    <div className="inline-flex rounded-full bg-surface-muted p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'inline-flex h-8 items-center gap-1.5 rounded-full px-4 text-[13px] font-medium transition-colors cursor-pointer',
            value === o.value ? 'bg-surface text-ink-900 shadow-[0_1px_2px_rgba(15,27,51,0.06)]' : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {o.dot && <span className={cx('size-1.5 rounded-full', o.dot)} />}
          {o.label}
          {o.count != null && <span className="num text-ink-400">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}

export const chipClass = (active: boolean, ai: boolean) =>
  cx(
    'inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-[13px] font-medium transition-colors cursor-pointer',
    active && ai && 'border-ai-100 bg-ai-50 text-ai-700',
    active && !ai && 'border-ink-900 bg-ink-900 text-white',
    !active && 'border-border bg-surface text-ink-900 hover:bg-surface-muted',
  )

export function ToggleChip({ label, active, ai, onClick }: { label: string; active: boolean; ai: boolean; onClick: () => void }) {
  return (
    <button className={chipClass(active, ai)} onClick={onClick}>
      {active && ai && <Sparkles size={14} />}
      {label}
      {active && <X size={14} className="opacity-70" />}
    </button>
  )
}

/** Hook: close a popover on outside click / Escape. */
export function usePopover() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return { open, setOpen, ref }
}

export function Popover({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('absolute z-30 mt-2 rounded-inner bg-surface p-1.5 shadow-pop', className)}>{children}</div>
}

export function MenuItem({ selected, multi, onClick, children }: { selected: boolean; multi?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] hover:bg-surface-muted cursor-pointer">
      <span className={cx(
        'flex size-4 shrink-0 items-center justify-center border',
        multi ? 'rounded' : 'rounded-full',
        selected ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200',
      )}>
        {selected && <Check size={11} strokeWidth={3} />}
      </span>
      {children}
    </button>
  )
}

/** Filter chip with a dropdown of options (multi or single select). */
/** Fixed-size trailing slot of a filter chip: chevron when empty, selection count when active – the chip never changes width. */
export function CountSlot({ n, ai = false }: { n: number; ai?: boolean }) {
  return (
    <span className="flex size-[18px] shrink-0 items-center justify-center">
      {n > 0
        ? <span className={cx('num flex size-[18px] items-center justify-center rounded-full text-[11px] font-semibold', ai ? 'bg-ai-700 text-white' : 'bg-white text-ink-900')}>{n}</span>
        : <ChevronDown size={14} className="opacity-70" />}
    </span>
  )
}

export function FilterMenu<V extends string>({
  label, options, selected, multi = false, ai = false, onChange, count,
}: {
  label: string
  options: readonly { value: V; label: string }[]
  selected: V[]
  multi?: boolean
  ai?: boolean
  onChange: (v: V[]) => void
  /** Optional facet count per option – how many patients the option would show. */
  count?: (v: V) => number
}) {
  const { open, setOpen, ref } = usePopover()
  const active = selected.length > 0
  const picked = options.filter((o) => selected.includes(o.value)).map((o) => o.label).join(', ')
  const toggle = (v: V) => {
    if (multi) onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v])
    else { onChange(selected.includes(v) ? [] : [v]); setOpen(false) }
  }

  return (
    <div ref={ref} className="relative">
      {/* Label stays the same and the count takes the chevron's slot, so picking options doesn't move the bar. */}
      <button className={cx(chipClass(active, ai), 'pr-2.5')} onClick={() => setOpen(!open)} title={active ? `${label}: ${picked}` : undefined}>
        {active && ai && <Sparkles size={14} />}
        {label}
        <CountSlot n={selected.length} ai={ai} />
      </button>
      {open && (
        <Popover className="min-w-60">
          {options.map((o) => (
            <MenuItem key={o.value} multi={multi} selected={selected.includes(o.value)} onClick={() => toggle(o.value)}>
              <span className={cx('flex-1', count && count(o.value) === 0 && !selected.includes(o.value) && 'text-ink-400')}>{o.label}</span>
              {count && <span className="num text-xs text-ink-400">{count(o.value)}</span>}
            </MenuItem>
          ))}
          {active && (
            <button onClick={() => { onChange([]); setOpen(false) }} className="mt-1 w-full rounded-lg px-2.5 py-2 text-left text-[13px] text-ink-600 hover:bg-surface-muted cursor-pointer">
              Zrušiť výber
            </button>
          )}
        </Popover>
      )}
    </div>
  )
}
