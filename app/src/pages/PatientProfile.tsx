import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, Clock, Minus, PenLine, Share2, Sparkles } from 'lucide-react'
import { Button, ExamPill, PatientStatusPill, Segmented } from '../components/ui'
import AiPanel, { AiFeedback } from '../components/AiPanel'
import TemTab from '../components/TemTab'
import { Fact, PatientFacts } from '../components/PatientFacts'
import {
  CLINICAL_INDEX_ITEMS, MIN_CILIA, NNO_THRESHOLD, PATIENTS, PICADAR_CUTOFF, PICADAR_ITEMS, PICADAR_MAX, idleDays, isStale,
} from '../data/patients'
import { caseSummary, findConflicts, type Conflict } from '../ai/engine'
import { EXAM_STATUS, ROLES, formatDate } from '../labels'
import { useConclusion, type Conclusion as ConclusionData } from '../conclusions'
import { AnamnesisModal, NnoForm } from '../components/Forms'
import { useStoreVersion, visitPatient } from '../store'
import { useRole } from '../role'
import type { ExamStatus, Patient } from '../types'

type TabId = 'anamnesis' | 'nno' | 'hsvm' | 'tem' | 'if' | 'genetics'

const label = (text: string) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">{text}</p>
)

function examStatus(p: Patient, tab: TabId): ExamStatus | null {
  return tab === 'anamnesis' ? null : p.exams[tab].status
}

// ---------- Header ----------

function ConclusionButton({ p }: { p: Patient }) {
  const { role } = useRole()
  const saved = useConclusion(p.id)
  // Only the treating clinician concludes; once saved, the conclusion card in the profile takes over.
  if (saved || role !== 'vojtech') return null
  return (
    <Link to={`/patients/${p.id}/conclusion`}>
      <Button variant="primary"><PenLine size={16} /> Napísať záver</Button>
    </Link>
  )
}

function Header({ p }: { p: Patient }) {
  return (
    <div className="rounded-card bg-surface p-6">
      <div className="flex items-center justify-between gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="font-mono text-[28px] font-semibold tracking-[-0.01em] whitespace-nowrap">{p.id}</h1>
            <PatientStatusPill status={p.status} />
            {isStale(p) && (
              <span className="num inline-flex h-6 items-center gap-1.5 rounded-full bg-wait-bg px-2.5 text-xs font-medium whitespace-nowrap text-wait">
                <Clock size={12} /> Stojí {idleDays(p)} dní
              </span>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            <PatientFacts p={p} />
            <Fact label="Ošetrujúci" title={ROLES[p.owner].title}>{ROLES[p.owner].name}</Fact>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button><Share2 size={16} /> Zdieľať</Button>
          <Link to={`/patients/${p.id}/similar`}><Button variant="aiSoft"><Sparkles size={16} /> Podobné prípady</Button></Link>
          <ConclusionButton p={p} />
        </div>
      </div>
    </div>
  )
}

// ---------- Exam overview cards ----------

function ExamCard({
  name, status, hideStatus, value, unit, detail, active, onClick,
}: {
  name: string; status: ExamStatus; hideStatus?: boolean; value?: string; unit?: string; detail?: string; active: boolean; onClick: () => void
}) {
  const notDone = status === 'notDone'
  return (
    <button
      onClick={onClick}
      className={`flex flex-col rounded-card px-5 py-3 text-left transition-shadow cursor-pointer ${notDone ? 'hatch bg-surface/60' : 'bg-surface'} ${
        active ? 'ring-2 ring-ink-900 ring-offset-2 ring-offset-canvas' : 'hover:shadow-pop'
      }`}
    >
      <div className="flex min-h-6 items-center justify-between">
        <span className="text-[15px] font-medium text-ink-600">{name}</span>
        {notDone
          ? <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-600">Nevykonané</span>
          : !hideStatus && <ExamPill status={status} text={EXAM_STATUS[status].label} />}
      </div>
      {value && (
        <p className="num mt-2 text-[22px] leading-none font-normal tracking-[-0.02em]">
          {value}{unit && <span className="ml-1 text-xs tracking-normal whitespace-nowrap text-ink-400">{unit}</span>}
        </p>
      )}
      {detail && <p className="mt-1.5 text-xs text-ink-600">{detail}</p>}
    </button>
  )
}

function ExamOverview({ p, tab, setTab }: { p: Patient; tab: TabId; setTab: (t: TabId) => void }) {
  const e = p.exams
  const tem = e.tem
  return (
    <div className="grid grid-cols-5 gap-4">
      <ExamCard name="nNO" status={e.nno.status} active={tab === 'nno'} onClick={() => setTab('nno')}
        value={e.nno.value != null ? String(e.nno.value) : undefined} unit="ppb"
        detail={e.nno.status === 'pending' ? 'meranie naplánované' : undefined} />
      <ExamCard name="HSVM" status={e.hsvm.status} active={tab === 'hsvm'} onClick={() => setTab('hsvm')}
        value={e.hsvm.status === 'abnormal' ? 'Abnormálny' : e.hsvm.status === 'normal' ? 'Normálny' : undefined}
        detail={e.hsvm.status === 'pending' ? 'video čaká na vyhodnotenie' : undefined} />
      {/* Finished TEM shows the finding itself; "/ 100" is only a progress target while evaluating. */}
      <ExamCard name="TEM" status={tem.status} hideStatus={tem.status === 'normal' || tem.status === 'abnormal'} active={tab === 'tem'} onClick={() => setTab('tem')}
        value={tem.ciliaCount != null ? String(tem.ciliaCount) : undefined}
        unit={tem.ciliaCount == null ? undefined : tem.ciliaCount < MIN_CILIA ? `/ ${MIN_CILIA} riasiniek` : 'vyhodnotených'}
        detail={tem.status === 'pending' && tem.ciliaCount == null ? 'snímky čakajú na vyhodnotenie' : undefined} />
      <ExamCard name="IF" status={e.if.status} active={tab === 'if'} onClick={() => setTab('if')}
        value={e.if.status === 'abnormal' ? 'Chýba proteín' : e.if.status === 'normal' ? 'Proteíny OK' : undefined}
        detail={e.if.status === 'pending' ? 'vzorka v laboratóriu' : undefined} />
      <ExamCard name="Genetika" status={e.genetics.status} active={tab === 'genetics'} onClick={() => setTab('genetics')}
        value={e.genetics.gene ?? (e.genetics.status === 'normal' ? 'Negatívna' : undefined)}
        detail={e.genetics.status === 'pending' ? 'výsledok z genetiky čaká' : undefined} />
    </div>
  )
}

// ---------- Conclusion ----------

function ConclusionCard({ p, c }: { p: Patient; c: ConclusionData }) {
  const { role } = useRole()
  return (
    <div className="rounded-card bg-surface p-6 ring-2 ring-ink-900 ring-offset-2 ring-offset-canvas">
      <div className="flex items-start justify-between gap-4">
        <div>
          {label('Záver')}
          <div className="mt-2 flex items-center gap-3">
            <PatientStatusPill status={c.verdict} />
            <span className="text-[13px] text-ink-600">{ROLES[c.author].name} · {formatDate(c.date)}</span>
          </div>
        </div>
        <Link to={`/patients/${p.id}/conclusion`}>
          <Button size="sm">{role === 'vojtech' ? 'Zobraziť / upraviť' : 'Zobraziť celý'}</Button>
        </Link>
      </div>
      {c.reasoning
        ? <p className="mt-4 line-clamp-3 whitespace-pre-line leading-relaxed">{c.reasoning}</p>
        : <p className="mt-4 text-ink-400">Bez zdôvodnenia</p>}
      {c.nextSteps.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <span className="text-ink-600">Ďalší postup</span>
          {c.nextSteps.map((s) => <span key={s} className="flex items-center gap-1.5"><Check size={14} />{s}</span>)}
        </div>
      )}
    </div>
  )
}

// ---------- AI: summary + conflicts (F05) ----------

function ConflictBlock({ c }: { c: Conflict }) {
  const [why, setWhy] = useState(false)
  return (
    <div className="mt-4 rounded-inner border border-ai-100 bg-surface p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-px shrink-0 text-ai-600" />
        <div className="flex-1">
          <p className="font-semibold text-ink-900">{c.title}</p>
          <p className="mt-1 text-[13px] text-ink-600">{c.suggestion}</p>
        </div>
      </div>
      {why && (
        <div className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
          <div className="rounded-inner bg-surface-muted p-3">
            {label('Naznačuje PCD')}
            <ul className="mt-2 space-y-1.5">
              {c.pro.map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-bad" />{x}</li>)}
            </ul>
          </div>
          <div className="rounded-inner bg-surface-muted p-3">
            {label('Hovorí proti PCD')}
            <ul className="mt-2 space-y-1.5">
              {c.contra.map((x) => <li key={x} className="flex gap-2"><span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ok" />{x}</li>)}
            </ul>
          </div>
        </div>
      )}
      <div className="mt-2 -ml-2"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>
    </div>
  )
}

function AiSummary({ p }: { p: Patient }) {
  const conflicts = findConflicts(p)
  return (
    <div className="rounded-card border border-ai-100 bg-ai-50 p-5">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-ai-700">
        <Sparkles size={16} /> AI súhrn prípadu
      </div>
      <p className="mt-2 leading-relaxed text-ink-900">{caseSummary(p).join(' ')}</p>
      {conflicts.map((c) => <ConflictBlock key={c.title} c={c} />)}
    </div>
  )
}

// ---------- Scores ----------

function ScoreCard({
  title, score, max, cutoff, items, note,
}: { title: string; score: number | null; max: number; cutoff?: number; items: { label: string; points?: number; on: boolean }[]; note?: string }) {
  return (
    <div className="rounded-card bg-surface p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium text-ink-600">{title}</span>
        {score != null && <span className="num text-[28px] leading-none tracking-[-0.02em]">{score}<span className="text-sm text-ink-400">/{max}</span></span>}
      </div>
      {score == null ? (
        <div className="hatch mt-4 rounded-inner p-3 text-[13px] text-ink-600"><span className="rounded bg-surface px-1">{note ?? 'Nevyplnené'}</span></div>
      ) : (
        <>
          <div className="mt-4 flex gap-1">
            {Array.from({ length: max }, (_, i) => (
              <span key={i} className={`h-1.5 flex-1 rounded-full ${i < score ? 'bg-ink-900' : 'bg-ink-200'} ${cutoff && i === cutoff ? 'ml-1.5' : ''}`} />
            ))}
          </div>
          {cutoff && <p className="mt-2 text-xs text-ink-600">≥ {cutoff} bodov = odporúčané ďalšie vyšetrenie na PCD</p>}
          <ul className="mt-4 space-y-2 text-[13px]">
            {items.map((i) => (
              <li key={i.label} className={`flex items-center gap-2 ${i.on ? 'text-ink-900' : 'text-ink-400'}`}>
                {i.on ? <Check size={14} className="shrink-0" /> : <Minus size={14} className="shrink-0" />}
                <span className="flex-1">{i.label}</span>
                {i.points != null && <span className="num text-xs">{i.on ? `+${i.points}` : '0'}</span>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

// ---------- Tabs ----------

function YesNo({ label: text, value, detail }: { label: string; value: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between rounded-inner bg-surface-muted px-4 py-3">
      <span className="text-[13px]">{text}</span>
      <span className={`text-[13px] font-medium ${value ? 'text-ink-900' : 'text-ink-400'}`}>{detail ?? (value ? 'Áno' : 'Nie')}</span>
    </div>
  )
}

function EmptyExam({ status, action }: { status: ExamStatus; action: string }) {
  return (
    <div className="hatch flex flex-col items-center rounded-inner py-12 text-center">
      <div className="rounded-inner bg-surface px-5 py-4">
        <p className="font-semibold">{status === 'pending' ? 'Výsledok sa čaká' : 'Vyšetrenie nebolo vykonané'}</p>
        <Button size="sm" className="mt-3">{action}</Button>
      </div>
    </div>
  )
}

function NnoTab({ p }: { p: Patient }) {
  const { role } = useRole()
  const [editing, setEditing] = useState(false)
  const canRecord = role === 'vojtech' // nNO is measured in the outpatient clinic
  const nno = p.exams.nno

  if (canRecord && (editing || nno.value == null)) {
    return <NnoForm p={p} onDone={() => setEditing(false)} onCancel={nno.value != null ? () => setEditing(false) : undefined} />
  }
  if (nno.value == null) {
    return (
      <div className="hatch flex flex-col items-center rounded-inner py-12 text-center">
        <div className="rounded-inner bg-surface px-5 py-4">
          <p className="font-semibold">{nno.status === 'pending' ? 'Výsledok sa čaká' : 'Meranie zatiaľ nebolo zapísané'}</p>
          <p className="mt-1 text-[13px] text-ink-600">nNO zapisuje ambulancia (ošetrujúci lekár).</p>
        </div>
      </div>
    )
  }
  return (
    <div>
      <p className="num text-[40px] leading-none tracking-[-0.02em]">{nno.value}<span className="ml-1 text-base text-ink-400">ppb</span></p>
      <p className="mt-2 text-[13px] text-ink-600">
        {nno.value < NNO_THRESHOLD ? 'Pod' : 'Nad'} diagnostickou hranicou {NNO_THRESHOLD} ppb. <span className="text-ink-400">(Hranicu treba overiť.)</span>
      </p>
      <div className="relative mt-8 h-3 rounded-full bg-surface-muted">
        <div className={`h-3 rounded-full ${nno.value < NNO_THRESHOLD ? 'bg-bad' : 'bg-ok'}`} style={{ width: `${Math.min(nno.value / 600, 1) * 100}%` }} />
        <div className="absolute -top-7 flex flex-col items-center" style={{ left: `${(NNO_THRESHOLD / 600) * 100}%`, transform: 'translateX(-50%)' }}>
          <span className="rounded-md bg-ink-900 px-2 py-0.5 text-[11px] text-white">hranica {NNO_THRESHOLD}</span>
          <span className="h-6 border-l border-dashed border-ink-900" />
        </div>
      </div>
      <div className="num mt-2 flex justify-between text-[11px] text-ink-400"><span>0</span><span>600 ppb</span></div>
      {canRecord && <Button size="sm" className="mt-6" onClick={() => setEditing(true)}>Upraviť meranie</Button>}
    </div>
  )
}

const SITUS_LABEL = { solitus: 'Situs solitus (normálny)', inversus: 'Situs inversus', ambiguus: 'Heterotaxia (situs ambiguus)' }

function AnamnesisTab({ p }: { p: Patient }) {
  const { role } = useRole()
  const [editing, setEditing] = useState(false)
  const canEdit = role === 'vojtech' // taken by the pediatrician
  const a = p.anamnesis
  const modal = editing && <AnamnesisModal p={p} onClose={() => setEditing(false)} />

  if (!a) {
    return (
      <div className="hatch flex flex-col items-center rounded-inner py-12 text-center">
        <div className="max-w-sm rounded-inner bg-surface px-5 py-4">
          <p className="font-semibold">Anamnéza zatiaľ nie je zapísaná</p>
          <p className="mt-1 text-[13px] text-ink-600">
            {canEdit
              ? 'Ak ju máš v UNIS alebo na dotazníku, môžeš ju sem prepísať. Dopočíta sa z nej PICADAR a klinický index.'
              : 'Anamnézu zapisuje ošetrujúci lekár.'}
          </p>
          {canEdit && <Button size="sm" variant="primary" className="mt-3" onClick={() => setEditing(true)}><PenLine size={14} /> Vyplniť anamnézu</Button>}
        </div>
        {modal}
      </div>
    )
  }
  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <YesNo label="Porucha laterality" value={a.situs !== 'solitus'} detail={SITUS_LABEL[a.situs]} />
        <YesNo label="RDS novorodenca" value={a.neonatalRds} />
        <YesNo label="Hospitalizácia na JIS novorodencov" value={a.nicu} />
        <YesNo label="Vrodená srdcová vada" value={a.heartDefect} />
        <YesNo label="PCD v rodine" value={a.familyPcd} />
        <YesNo label="Počet súrodencov" value={a.siblings > 0} detail={String(a.siblings)} />
        <YesNo label="Denný vlhký kašeľ" value={a.wetCough} />
        <YesNo label="Chronická rinitída" value={a.rhinitis} />
        <YesNo label="Ušné / sluchové problémy" value={a.otitis} />
        <YesNo label="Narodenie v termíne" value={a.fullTerm} />
      </div>
      {canEdit && <Button size="sm" className="mt-6" onClick={() => setEditing(true)}><PenLine size={14} /> Upraviť anamnézu</Button>}
      {modal}
    </div>
  )
}

function TabContent({ p, tab }: { p: Patient; tab: TabId }) {
  const e = p.exams

  switch (tab) {
    case 'anamnesis':
      return <AnamnesisTab p={p} />
    case 'nno':
      return <NnoTab p={p} />
    case 'hsvm':
      if (e.hsvm.status === 'notDone' || e.hsvm.status === 'pending') return <EmptyExam status={e.hsvm.status} action="Nahrať video" />
      return (
        <div className="grid grid-cols-2 gap-2">
          <YesNo label="Vzorec pohybu" value={e.hsvm.status === 'abnormal'} detail={e.hsvm.status === 'abnormal' ? 'Abnormálny' : 'Normálny'} />
          <YesNo label="Frekvencia úderu (CBF)" value detail={e.hsvm.status === 'abnormal' ? '4,2 Hz (znížená)' : '11,8 Hz'} />
          <YesNo label="Imobilné riasinky" value={e.hsvm.status === 'abnormal'} detail={e.hsvm.status === 'abnormal' ? 'Áno, čiastočne' : 'Nie'} />
          <YesNo label="Videozáznamy" value detail="3 videá" />
        </div>
      )
    case 'tem':
      return <TemTab key={p.id} p={p} />
    case 'if':
      if (e.if.status === 'notDone' || e.if.status === 'pending') return <EmptyExam status={e.if.status} action="Pridať výsledok" />
      return (
        <div className="grid grid-cols-2 gap-2">
          {['DNAH5', 'GAS8', 'RSPH4A', 'DNALI1'].map((protein, i) => (
            <YesNo key={protein} label={protein} value={!(e.if.status === 'abnormal' && i === 0)} detail={e.if.status === 'abnormal' && i === 0 ? 'Chýba' : 'Prítomný'} />
          ))}
        </div>
      )
    case 'genetics':
      if (e.genetics.status === 'notDone' || e.genetics.status === 'pending') return <EmptyExam status={e.genetics.status} action="Pridať výsledok" />
      return (
        <div className="grid grid-cols-2 gap-2">
          <YesNo label="Výsledok" value detail={e.genetics.gene ? 'Patogénny variant' : 'Bez nálezu'} />
          {e.genetics.gene && <YesNo label="Gén" value detail={e.genetics.gene} />}
          {e.genetics.gene && <YesNo label="Zygozita" value detail="Homozygot" />}
          <YesNo label="Pracovisko" value detail="Externé genetické pracovisko" />
        </div>
      )
  }
}

const TABS: { value: TabId; label: string }[] = [
  { value: 'anamnesis', label: 'Anamnéza' },
  { value: 'nno', label: 'nNO' },
  { value: 'hsvm', label: 'HSVM' },
  { value: 'tem', label: 'TEM' },
  { value: 'if', label: 'IF' },
  { value: 'genetics', label: 'Genetika' },
]

// ---------- Page ----------

export default function PatientProfile() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const { role } = useRole()
  const [pickedTab, setTab] = useState<TabId | null>(params.get('tab') as TabId | null)
  // Until a tab is picked, the histopathologist lands on her own exam.
  const tab: TabId = pickedTab ?? (role === 'michaela' ? 'tem' : 'anamnesis')
  useStoreVersion() // re-render after in-memory edits (nNO, uploads, conclusion)
  useEffect(() => { if (id && PATIENTS.some((x) => x.id === id)) visitPatient(id) }, [id])
  // Follow ?tab= also when the profile is already open (e.g. from a notification).
  const tabParam = params.get('tab') as TabId | null
  useEffect(() => { if (tabParam) setTab(tabParam) }, [tabParam, id])
  const p = PATIENTS.find((x) => x.id === id)
  const conclusion = useConclusion(id)
  const aiOpen = params.get('ai') === 'similar'
  const setAiOpen = (open: boolean) => setParams(open ? { ai: 'similar' } : {})

  if (!p) {
    return (
      <div className="px-1 pt-2">
        <Link to="/patients" className="inline-flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900"><ArrowLeft size={14} /> Pacienti</Link>
        <h1 className="mt-3 text-[28px] font-semibold">Pacient {id} neexistuje</h1>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-4">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <Link to="/patients" className="inline-flex items-center gap-1.5 px-1 pt-1 text-[13px] text-ink-600 hover:text-ink-900">
          <ArrowLeft size={14} /> Pacienti
        </Link>

        <Header p={p} />
        <ExamOverview p={p} tab={tab} setTab={setTab} />

        <div className={`grid gap-4 ${aiOpen ? 'grid-cols-1' : 'grid-cols-3'}`}>
          <div className={`flex flex-col gap-4 ${aiOpen ? '' : 'col-span-2'}`}>
            {conclusion && <ConclusionCard p={p} c={conclusion} />}
            <AiSummary p={p} />
            <div className="rounded-card bg-surface p-6">
              <div className="mb-5 flex items-center justify-between">
                <Segmented<TabId>
                  value={tab}
                  onChange={setTab}
                  options={TABS.map((t) => {
                    const s = examStatus(p, t.value)
                    return { ...t, dot: s ? EXAM_STATUS[s].dot : undefined }
                  })}
                />
              </div>
              <TabContent p={p} tab={tab} />
            </div>
          </div>

          {!aiOpen && (
            <div className="flex flex-col gap-4">
              <ScoreCard
                title="PICADAR" score={p.picadar} max={PICADAR_MAX} cutoff={PICADAR_CUTOFF}
                note={!p.anamnesis ? 'Bez anamnézy' : !p.anamnesis.wetCough ? 'Neaplikuje sa – bez denného vlhkého kašľa' : undefined}
                items={PICADAR_ITEMS.map((i) => ({ label: i.label, points: i.points, on: !!p.anamnesis && i.get(p.anamnesis) }))}
              />
              <ScoreCard
                title="Klinický index" score={p.clinicalIndex} max={CLINICAL_INDEX_ITEMS.length}
                note={!p.anamnesis ? 'Bez anamnézy' : undefined}
                items={CLINICAL_INDEX_ITEMS.map((i) => ({ label: i.label, on: !!p.anamnesis && i.get(p.anamnesis) }))}
              />
            </div>
          )}
        </div>
      </div>

      {aiOpen && <AiPanel patient={p} onClose={() => setAiOpen(false)} />}
    </div>
  )
}
