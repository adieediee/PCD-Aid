import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Check, CircleCheck, Sparkles } from 'lucide-react'
import { Button, ExamPill, PatientStatusPill, ToggleChip } from '../components/ui'
import { AiFeedback } from '../components/AiPanel'
import { MIN_CILIA, PATIENTS, PICADAR_MAX, ageOf, CLINICAL_INDEX_ITEMS } from '../data/patients'
import { outcomeSummary, secondOpinion, type Finding, type SecondOpinion, type Verdict } from '../ai/engine'
import { saveConclusion, useConclusion, type Conclusion as ConclusionData } from '../conclusions'
import { DEFECT_LABEL, PATIENT_STATUS, ROLES } from '../labels'
import { useRole } from '../role'
import type { Patient } from '../types'

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400'

const VERDICTS: { value: Verdict; label: string; hint: string }[] = [
  { value: 'confirmed', label: 'Potvrdená PCD', hint: 'Diagnóza PCD je stanovená' },
  { value: 'excluded', label: 'Vylúčená PCD', hint: 'Diagnostika PCD sa uzatvára' },
  { value: 'unclear', label: 'Nejasný prípad', hint: 'Pokračovať v diagnostike' },
]

const NEXT_STEPS = ['Doplniť genetiku', 'Doplniť IF', 'Tomografia', 'Zopakovať nNO', 'Nový odber na TEM', 'Kontrola o 6 mesiacov']

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

// ---------- Left column: evidence (no AI here – the doctor decides first) ----------

function EvidenceRow({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-3 last:border-0">
      <span className="text-[13px] text-ink-600">{name}</span>
      <div className="flex items-center gap-2 text-right text-[13px]">{children}</div>
    </div>
  )
}

function Evidence({ p }: { p: Patient }) {
  const e = p.exams
  return (
    <div className="rounded-card bg-surface p-5">
      <p className={sectionLabel}>Podklady</p>
      <div className="mt-2">
        <EvidenceRow name="nNO">
          {e.nno.value != null && <span className="num">{e.nno.value} <span className="text-ink-400">ppb</span></span>}
          <ExamPill status={e.nno.status} />
        </EvidenceRow>
        <EvidenceRow name="HSVM"><ExamPill status={e.hsvm.status} /></EvidenceRow>
        <EvidenceRow name="TEM">
          {e.tem.defect && <span className="max-w-36 truncate" title={DEFECT_LABEL[e.tem.defect]}>{DEFECT_LABEL[e.tem.defect]}</span>}
          <ExamPill status={e.tem.status} />
        </EvidenceRow>
        {e.tem.ciliaCount != null && (
          <EvidenceRow name="Riasinky (TEM)">
            <span className={`num ${e.tem.ciliaCount < MIN_CILIA ? 'font-medium text-wait' : ''}`}>{e.tem.ciliaCount} <span className="text-ink-400">/ {MIN_CILIA}</span></span>
          </EvidenceRow>
        )}
        <EvidenceRow name="IF"><ExamPill status={e.if.status} /></EvidenceRow>
        <EvidenceRow name="Genetika">
          {e.genetics.gene && <span className="font-mono">{e.genetics.gene}</span>}
          <ExamPill status={e.genetics.status} />
        </EvidenceRow>
        <EvidenceRow name="PICADAR">
          {p.picadar != null ? <span className="num">{p.picadar}<span className="text-ink-400">/{PICADAR_MAX}</span></span> : <span className="hatch inline-block h-6 w-12 rounded-full" />}
        </EvidenceRow>
        <EvidenceRow name="Klinický index">
          {p.clinicalIndex != null ? <span className="num">{p.clinicalIndex}<span className="text-ink-400">/{CLINICAL_INDEX_ITEMS.length}</span></span> : <span className="hatch inline-block h-6 w-12 rounded-full" />}
        </EvidenceRow>
      </div>
      <Link to={`/patients/${p.id}`} className="mt-3 inline-block text-[13px] text-ink-600 underline-offset-2 hover:text-ink-900 hover:underline">
        Otvoriť celý profil
      </Link>
    </div>
  )
}

// ---------- Second opinion (F06) ----------

function FindingList({ title, dot, items }: { title: string; dot: string; items: Finding[] }) {
  if (!items.length) return null
  return (
    <div className="rounded-inner bg-surface p-3">
      <p className={sectionLabel}>{title}</p>
      <ul className="mt-2 space-y-1.5 text-[13px]">
        {items.map((f) => <li key={f.text} className="flex gap-2"><span className={`mt-1.5 size-1.5 shrink-0 rounded-full ${dot}`} />{f.text}</li>)}
      </ul>
    </div>
  )
}

function WhyDetail({ op }: { op: SecondOpinion }) {
  const o = outcomeSummary(op.similar)
  return (
    <div className="mt-3 space-y-3 rounded-inner bg-surface p-4 text-[13px] text-ink-600">
      <div>
        <p className={sectionLabel}>Postup kontroly</p>
        <ol className="mt-2 space-y-1.5">
          {op.path.map((s, i) => (
            <li key={s} className="flex gap-2.5"><span className="num flex size-5 shrink-0 items-center justify-center rounded-full bg-ai-50 text-[11px] font-semibold text-ai-700">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </div>
      {op.similar.length > 0 && (
        <div>
          <p className={sectionLabel}>Podobní pacienti {o.closed > 0 && `· ${o.confirmed} z ${o.closed} so záverom malo PCD`}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {op.similar.slice(0, 6).map((c) => (
              <Link key={c.patient.id} to={`/patients/${c.patient.id}`}
                className="inline-flex h-7 items-center gap-1.5 rounded-full border border-ai-100 px-2.5 font-mono text-xs text-ink-900 hover:bg-ai-50">
                <span className={`size-1.5 rounded-full ${PATIENT_STATUS[c.patient.status].dot}`} />{c.patient.id}
              </Link>
            ))}
          </div>
          {o.closed < 10 && <p className="mt-2 text-xs">Malá vzorka (n = {o.closed}) – ber to ako orientačný údaj.</p>}
        </div>
      )}
    </div>
  )
}

function OpinionCard({ op, onEdit, onKeep }: { op: SecondOpinion; onEdit: () => void; onKeep: (note: string) => void }) {
  const [why, setWhy] = useState(false)
  const [note, setNote] = useState('')
  return (
    <div className="rounded-card border border-ai-100 bg-ai-50 p-5">
      <div className="flex items-center gap-2 text-[15px] font-semibold text-ai-700">
        <Sparkles size={16} /> Druhý názor
      </div>
      <div className="mt-3 flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-px shrink-0 text-ai-600" />
        <p className="font-semibold leading-snug">{op.headline}</p>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <FindingList title="Naznačuje PCD" dot="bg-bad" items={op.findings.filter((f) => f.towards === 'pcd')} />
        <FindingList title="Hovorí proti PCD" dot="bg-ok" items={op.findings.filter((f) => f.towards === 'notPcd')} />
        <FindingList title="Otvorené" dot="bg-wait" items={op.findings.filter((f) => f.towards === 'open')} />
      </div>

      {why && <WhyDetail op={op} />}
      <div className="mt-2 -ml-2"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>

      <div className="mt-4 rounded-inner bg-surface p-4">
        <p className="text-[13px] text-ink-600">AI záver nemení. Rozhodnutie je na vás.</p>
        <textarea
          value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="Prečo ponechávate záver? (nepovinné, uloží sa k záveru)"
          className="mt-3 w-full resize-none rounded-inner bg-surface-muted px-4 py-3 text-sm outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-ink-200"
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button onClick={onEdit}>Upraviť záver</Button>
          <Button variant="primary" onClick={() => onKeep(note)}>Ponechať a uložiť</Button>
        </div>
      </div>
    </div>
  )
}

// ---------- Saved conclusion ----------

function SavedCard({ p, c, canEdit, onEdit }: { p: Patient; c: ConclusionData; canEdit: boolean; onEdit: () => void }) {
  const [why, setWhy] = useState(false)
  const op = secondOpinion(p, c.verdict)
  return (
    <div className="rounded-card bg-surface p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <CircleCheck size={22} className="text-ok" />
          <h2 className="text-lg font-semibold">Záver uložený</h2>
        </div>
        <PatientStatusPill status={c.verdict} />
      </div>
      <p className="mt-1 text-[13px] text-ink-600">{ROLES[c.author].name} · {ROLES[c.author].title} · {formatDate(c.date)}</p>

      <p className={`${sectionLabel} mt-6`}>Zdôvodnenie</p>
      {c.reasoning ? <p className="mt-2 whitespace-pre-line leading-relaxed">{c.reasoning}</p> : <p className="mt-2 text-ink-400">Bez zdôvodnenia</p>}

      {c.nextSteps.length > 0 && (
        <>
          <p className={`${sectionLabel} mt-5`}>Ďalší postup</p>
          <ul className="mt-2 space-y-1.5">
            {c.nextSteps.map((s) => <li key={s} className="flex items-center gap-2 text-[13px]"><Check size={14} />{s}</li>)}
          </ul>
        </>
      )}

      <div className="mt-6 rounded-inner border border-ai-100 bg-ai-50 p-4 text-[13px]">
        <div className="flex items-center gap-2 font-semibold text-ai-700">
          <Sparkles size={14} />
          {c.ai === 'agreed' && 'AI kontrola nenašla rozpor s vaším záverom'}
          {c.ai === 'disagreed-kept' && 'AI mala iný názor – záver ponechaný'}
          {c.ai === 'disagreed-changed' && 'Záver upravený po druhom názore AI'}
        </div>
        {c.ai === 'disagreed-kept' && <p className="mt-1.5 text-ink-600">{op.headline || 'Podklady sa odvtedy zmenili.'}</p>}
        {c.keepNote && <p className="mt-1.5 text-ink-900">Poznámka lekára: „{c.keepNote}“</p>}
        {why && <WhyDetail op={op} />}
        <div className="mt-1 -ml-2"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        {canEdit && <Button onClick={onEdit}>Upraviť záver</Button>}
        <Link to={`/patients/${p.id}`}><Button variant="primary">Späť na profil</Button></Link>
      </div>
    </div>
  )
}

// ---------- Page ----------

type Phase = 'edit' | 'checking' | 'review'

export default function ConclusionPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { role } = useRole()
  const p = PATIENTS.find((x) => x.id === id)
  const saved = useConclusion(id)

  const [editing, setEditing] = useState(false)
  const [phase, setPhase] = useState<Phase>('edit')
  const [verdict, setVerdict] = useState<Verdict | null>(saved?.verdict ?? null)
  const [reasoning, setReasoning] = useState(saved?.reasoning ?? '')
  const [nextSteps, setNextSteps] = useState<string[]>(saved?.nextSteps ?? [])
  const [opinion, setOpinion] = useState<SecondOpinion | null>(null)
  const [wasDisagreed, setWasDisagreed] = useState(false)

  if (!p) return <p className="p-4">Pacient {id} neexistuje.</p>
  const canEdit = role === 'vojtech' // only the treating clinician concludes

  const save = (ai: ConclusionData['ai'], keepNote?: string) => {
    saveConclusion(p.id, { verdict: verdict!, reasoning: reasoning.trim(), nextSteps, author: role, ai, keepNote: keepNote?.trim() || undefined })
    setEditing(false)
    setPhase('edit')
  }

  const submit = () => {
    setPhase('checking')
    // Simulated thinking time – the opinion is computed only now, never before the doctor commits.
    setTimeout(() => {
      const op = secondOpinion(p, verdict!)
      if (op.agrees) save(wasDisagreed ? 'disagreed-changed' : 'agreed')
      else { setOpinion(op); setWasDisagreed(true); setPhase('review') }
    }, 1400)
  }

  const showForm = canEdit && (!saved || editing)
  const locked = phase !== 'edit'

  return (
    <div className="flex flex-col gap-4">
      <button onClick={() => navigate(`/patients/${p.id}`)} className="inline-flex items-center gap-1.5 self-start px-1 pt-1 text-[13px] text-ink-600 hover:text-ink-900 cursor-pointer">
        <ArrowLeft size={14} /> {p.id}
      </button>

      <div className="px-1">
        <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Záver · <span className="font-mono">{p.id}</span></h1>
        <p className="num mt-1 text-ink-600">Odber {p.sampleNo} · nar. {p.birthYear} ({ageOf(p)} r.) · záver stanovuje ošetrujúci lekár</p>
      </div>

      <div className="grid grid-cols-3 items-start gap-4">
        <Evidence p={p} />

        <div className="col-span-2 flex flex-col gap-4">
          {!showForm && saved && <SavedCard p={p} c={saved} canEdit={canEdit} onEdit={() => { setEditing(true); setWasDisagreed(saved.ai !== 'agreed') }} />}

          {!showForm && !saved && (
            <div className="hatch rounded-card p-10 text-center">
              <div className="inline-block rounded-inner bg-surface px-6 py-5">
                <p className="font-semibold">Záver zatiaľ nebol stanovený</p>
                <p className="mt-1 text-[13px] text-ink-600">Záver píše ošetrujúci lekár. Pre test prepni rolu na {ROLES.vojtech.name}.</p>
              </div>
            </div>
          )}

          {showForm && (
            <div className={`rounded-card bg-surface p-6 ${locked ? 'opacity-70' : ''}`}>
              <h2 className="text-lg font-semibold">Váš záver</h2>
              <p className="mt-1 text-[13px] text-ink-600">Vyberte záver a stručne ho zdôvodnite.</p>

              <div className="mt-5 grid grid-cols-3 gap-2">
                {VERDICTS.map((v) => (
                  <button
                    key={v.value} disabled={locked} onClick={() => setVerdict(v.value)}
                    className={`rounded-inner border p-4 text-left transition-colors cursor-pointer disabled:cursor-default ${
                      verdict === v.value ? 'border-ink-900 ring-1 ring-ink-900' : 'border-border hover:bg-surface-muted'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 font-medium">
                        <span className={`size-2 rounded-full ${PATIENT_STATUS[v.value].dot}`} />{v.label}
                      </span>
                      <span className={`flex size-4 items-center justify-center rounded-full border ${verdict === v.value ? 'border-ink-900 bg-ink-900 text-white' : 'border-ink-200'}`}>
                        {verdict === v.value && <Check size={11} strokeWidth={3} />}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">{v.hint}</p>
                  </button>
                ))}
              </div>

              <p className={`${sectionLabel} mt-6`}>Zdôvodnenie</p>
              <textarea
                value={reasoning} onChange={(e) => setReasoning(e.target.value)} disabled={locked} rows={5}
                placeholder="Na základe čoho ste sa rozhodli…"
                className="mt-2 w-full resize-none rounded-inner bg-surface-muted px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-ink-200"
              />

              <p className={`${sectionLabel} mt-5`}>Ďalší postup</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {NEXT_STEPS.map((s) => (
                  <ToggleChip key={s} label={s} ai={false} active={nextSteps.includes(s)}
                    onClick={() => !locked && setNextSteps(nextSteps.includes(s) ? nextSteps.filter((x) => x !== s) : [...nextSteps, s])} />
                ))}
              </div>

              {phase === 'edit' && (
                <div className="mt-6 flex items-center justify-between gap-4 border-t border-border pt-5">
                  <p className="flex items-center gap-2 text-xs text-ink-600">
                    <Sparkles size={14} className="text-ai-600" />
                    AI záver skontroluje až po uložení a ozve sa len vtedy, ak podklady naznačujú niečo iné.
                  </p>
                  <div className="flex gap-2">
                    {editing && <Button onClick={() => setEditing(false)}>Zrušiť</Button>}
                    <Button variant="primary" disabled={!verdict} onClick={submit} className="disabled:cursor-not-allowed disabled:opacity-40">
                      Uložiť záver
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {showForm && phase === 'checking' && (
            <div className="flex items-center gap-2 rounded-card border border-ai-100 bg-ai-50 p-5 text-[15px] font-medium text-ai-700">
              <Sparkles size={16} className="animate-pulse" /> <span className="animate-pulse">Kontrolujem záver voči podkladom…</span>
            </div>
          )}

          {showForm && phase === 'review' && opinion && (
            <OpinionCard op={opinion} onEdit={() => setPhase('edit')} onKeep={(note) => save('disagreed-kept', note)} />
          )}
        </div>
      </div>
    </div>
  )
}
