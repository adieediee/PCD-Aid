import { useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ExternalLink, Sparkles } from 'lucide-react'
import { ExamPill, PatientStatusPill, ToggleChip } from '../components/ui'
import { AiFeedback } from '../components/AiPanel'
import { PatientFacts } from '../components/PatientFacts'
import { PATIENTS } from '../data/patients'
import {
  defaultCriteria, findCohort, missingAtExclusion, openLeads, outcomeSummary, similarityCriteria,
} from '../ai/engine'
import { DEFECT_SHORT } from '../labels'
import { useStoreVersion } from '../store'
import type { Patient } from '../types'

// ---------- Table rows ----------

interface Row {
  label: string
  cell: (p: Patient) => ReactNode
  /** Comparable value; null = nothing to compare (missing result or absent finding). */
  key?: (p: Patient) => string | null
}

const finished = (s: string) => s === 'normal' || s === 'abnormal'

const flagRow = (label: string, get: (p: Patient) => boolean): Row => ({
  label,
  cell: (p) => (p.anamnesis ? <span className={get(p) ? 'text-[13px] font-medium' : 'text-[13px] text-ink-400'}>{get(p) ? 'áno' : 'nie'}</span> : <ExamPill status="notDone" />),
  key: (p) => (p.anamnesis && get(p) ? 'yes' : null),
})

const EXAM_ROWS: Row[] = [
  {
    label: 'TEM',
    cell: (p) => <ExamPill status={p.exams.tem.status} text={p.exams.tem.defect && finished(p.exams.tem.status) ? DEFECT_SHORT[p.exams.tem.defect] : undefined} />,
    key: (p) => (finished(p.exams.tem.status) ? p.exams.tem.defect : null),
  },
  {
    label: 'nNO',
    cell: (p) => <ExamPill status={p.exams.nno.status} text={p.exams.nno.value != null ? `${p.exams.nno.value} ppb` : undefined} />,
    key: (p) => (finished(p.exams.nno.status) ? p.exams.nno.status : null),
  },
  { label: 'HSVM', cell: (p) => <ExamPill status={p.exams.hsvm.status} />, key: (p) => (finished(p.exams.hsvm.status) ? p.exams.hsvm.status : null) },
  { label: 'IF', cell: (p) => <ExamPill status={p.exams.if.status} />, key: (p) => (finished(p.exams.if.status) ? p.exams.if.status : null) },
  {
    label: 'Genetika',
    cell: (p) => <ExamPill status={p.exams.genetics.status} text={p.exams.genetics.gene ?? undefined} />,
    key: (p) => p.exams.genetics.gene,
  },
]

const ANAMNESIS_ROWS: Row[] = [
  flagRow('Porucha laterality', (p) => !!p.anamnesis && p.anamnesis.situs !== 'solitus'),
  flagRow('RDS novorodenca', (p) => !!p.anamnesis?.neonatalRds),
  flagRow('Srdcová vada', (p) => !!p.anamnesis?.heartDefect),
  flagRow('PCD v rodine', (p) => !!p.anamnesis?.familyPcd),
  { label: 'PICADAR', cell: (p) => (p.picadar != null ? <span className="num text-[13px]">{p.picadar}/14</span> : <ExamPill status="notDone" />) },
]

const OUTCOME_ROWS: Row[] = [
  {
    label: 'Stav',
    cell: (p) => <PatientStatusPill status={p.status} />,
  },
  {
    label: 'Pri vylúčení chýbalo',
    cell: (p) => {
      const missing = missingAtExclusion(p)
      return missing.length ? <span className="text-[13px] font-medium">{missing.join(', ')}</span> : <span className="text-[13px] text-ink-400">–</span>
    },
  },
]

// ---------- Table ----------

const LABEL_COL = 'sticky left-0 z-10 w-44 min-w-44 bg-surface pr-4'
const CURRENT_COL = 'sticky left-44 z-10 w-36 min-w-36 bg-surface-muted px-3'

function Section({ title, rows, current, cohort }: { title: string; rows: Row[]; current: Patient; cohort: Patient[] }) {
  return (
    <>
      <tr>
        <th scope="colgroup" className={`${LABEL_COL} pt-5 pb-2 text-left text-[11px] font-semibold tracking-[0.06em] text-ink-400 uppercase`}>{title}</th>
        <td className={CURRENT_COL} />
        <td colSpan={cohort.length} />
      </tr>
      {rows.map((row) => {
        const own = row.key?.(current) ?? null
        return (
          <tr key={row.label} className="border-t border-border">
            <th scope="row" className={`${LABEL_COL} py-2.5 text-left text-[13px] font-medium text-ink-600`}>{row.label}</th>
            <td className={`${CURRENT_COL} py-2.5`}>{row.cell(current)}</td>
            {cohort.map((q) => {
              const same = own != null && row.key?.(q) === own
              return <td key={q.id} className={`min-w-36 px-3 py-2.5 ${same ? 'bg-ai-50' : ''}`}>{row.cell(q)}</td>
            })}
          </tr>
        )
      })}
    </>
  )
}

function ComparisonTable({ current, cohort }: { current: Patient; cohort: Patient[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className={`${LABEL_COL} pb-3`} />
            <th scope="col" className={`${CURRENT_COL} rounded-t-inner py-3 text-left`}>
              <span className="font-mono text-[13px] font-semibold">{current.id}</span>
              <span className="block text-[11px] font-normal text-ink-600">tento pacient</span>
            </th>
            {cohort.map((q) => (
              <th key={q.id} scope="col" className="min-w-36 px-3 py-3 text-left align-top">
                <Link to={`/patients/${q.id}`} target="_blank" title="Otvoriť profil v novom okne" className="inline-flex items-center gap-1 font-mono text-[13px] font-semibold hover:underline">
                  {q.id} <ExternalLink size={12} className="text-ink-400" />
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <Section title="Výsledok" rows={OUTCOME_ROWS} current={current} cohort={cohort} />
          <Section title="Vyšetrenia" rows={EXAM_ROWS} current={current} cohort={cohort} />
          <Section title="Anamnéza" rows={ANAMNESIS_ROWS} current={current} cohort={cohort} />
        </tbody>
      </table>
    </div>
  )
}

// ---------- Page ----------

const patientsWord = (n: number) => (n === 1 ? 'pacient' : n < 5 ? 'pacienti' : 'pacientov')

function Comparison({ p }: { p: Patient }) {
  const criteria = similarityCriteria(p)
  const [selected, setSelected] = useState(() => defaultCriteria(p, criteria))
  const [why, setWhy] = useState(false)
  const toggle = (id: string) => setSelected(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])

  const active = criteria.filter((c) => selected.includes(c.id))
  const cohort = findCohort(p, active)
  const o = outcomeSummary(cohort)
  const excluded = o.closed - o.confirmed
  const incomplete = cohort.filter((c) => missingAtExclusion(c.patient).length > 0).length
  const leads = openLeads(p, cohort).filter((l) => l.confirmed > 0)

  return (
    <>
      <div className="rounded-card border border-ai-100 bg-ai-50 p-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ai-700">
          <Sparkles size={16} /> Podobnosť podľa
        </div>
        {criteria.length === 0 ? (
          <p className="mt-2 text-sm text-ink-600">Pacient zatiaľ nemá výsledky ani anamnézu, s ktorými by sa dal porovnať.</p>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            {criteria.map((c) => <ToggleChip key={c.id} label={c.label} active={selected.includes(c.id)} ai onClick={() => toggle(c.id)} />)}
          </div>
        )}

        {cohort.length > 0 && (
          <div className="mt-4 text-sm">
            <p>
              <span className="num font-semibold">{cohort.length} {patientsWord(cohort.length)}</span>
              {' '}spĺňa všetky vybrané kritériá: {o.confirmed} s potvrdenou PCD, {excluded} {excluded === 1 ? 'vylúčený' : 'vylúčených'}
              {incomplete > 0 && ` (bez všetkých vyšetrení: ${incomplete})`}, {o.open} bez záveru.
              <span className="text-ink-600"> Malá vzorka, ber to ako orientačný údaj.</span>
            </p>
            {leads.length > 0 && (
              <p className="mt-1">
                {p.id} ešte nemá výsledok: {leads.map((l) => `${l.exam} (mimo normy u ${l.abnormal} z ${l.confirmed} potvrdených)`).join(', ')}.
              </p>
            )}
          </div>
        )}

        {why && (
          <div className="mt-3 rounded-inner bg-surface p-4 text-[13px] leading-relaxed text-ink-600">
            Kritériá som predvybral tak, aby ostala malá skupina na porovnanie, a môžeš ich meniť. V tabuľke je len pacient, ktorý
            spĺňa <b className="font-semibold text-ink-900">všetky</b> vybrané kritériá. Modré políčko znamená zhodu s {p.id}.
            Stav „vylúčená“ nemusí byť konečný: pri každom vylúčenom vidíš, ktoré vyšetrenia v tom čase chýbali.
          </div>
        )}
        <div className="-ml-2 mt-2"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>
      </div>

      <div className="rounded-card bg-surface p-6">
        {cohort.length > 0 ? (
          <ComparisonTable current={p} cohort={cohort.map((c) => c.patient)} />
        ) : (
          <p className="text-sm text-ink-600">
            {active.length === 0 ? 'Vyberte aspoň jedno kritérium.' : 'Žiadny pacient nespĺňa všetky vybrané kritériá. Skúste niektoré vypnúť.'}
          </p>
        )}
      </div>
    </>
  )
}

export default function SimilarCases() {
  const { id } = useParams()
  useStoreVersion()
  const p = PATIENTS.find((x) => x.id === id)

  if (!p) {
    return (
      <div className="px-1 pt-2">
        <Link to="/patients" className="inline-flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"><ArrowLeft size={14} /> Pacienti</Link>
        <h1 className="mt-3 text-[28px] font-semibold">Pacient {id} neexistuje</h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Link to={`/patients/${p.id}`} className="inline-flex items-center gap-1.5 self-start px-1 pt-1 text-[13px] text-ink-600 hover:text-ink-900">
        <ArrowLeft size={14} /> {p.id}
      </Link>
      <div className="rounded-card bg-surface p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Podobné prípady · <span className="font-mono">{p.id}</span></h1>
          <PatientStatusPill status={p.status} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1"><PatientFacts p={p} /></div>
      </div>
      <Comparison key={p.id} p={p} />
    </div>
  )
}
