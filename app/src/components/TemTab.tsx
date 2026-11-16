import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Check, CheckCheck, ChevronDown, ExternalLink, Send, Sparkles, Upload, X } from 'lucide-react'
import { Button, FilterMenu, Pagination, Segmented } from './ui'
import { AiFeedback } from './AiPanel'
import TemThumb from './TemThumb'
import { MIN_CILIA, MIN_DYNEIN_CILIA } from '../data/patients'
import { CATEGORY_LABEL, temDetails, type TemDetails, type TemImage } from '../data/tem'
import { LOW_CILIA_NOTE, draftReport, draftSources } from '../ai/report'
import { ROLES, formatDate } from '../labels'
import { useRole } from '../role'
import { TemUploadModal } from './Forms'
import { notify, recipients } from '../notifications'
import { hasMockImages, markOpened, openedImages, reportSent, setReportSent, uploadedImages, useStoreVersion } from '../store'
import type { Patient } from '../types'

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400'

// ---------- Stats ----------

function StatTile({ label, title, value, unit, className, children }: {
  label: string; title?: string; value: number; unit?: string; className: string; children: ReactNode
}) {
  return (
    <div title={title} className={`rounded-inner bg-surface-muted p-4 ${className}`}>
      <p className="min-h-8 text-xs leading-4 text-ink-600">{label}</p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span className="num text-[28px] leading-none tracking-[-0.02em]">{value}</span>
        {unit && <span className="text-[13px] text-ink-400">{unit}</span>}
      </p>
      {children}
    </div>
  )
}

/** Tile for an evaluation minimum: progress towards the required number of cilia. */
function MinimumTile({ label, n, min }: { label: string; n: number; min: number }) {
  const segments = 5
  const met = n >= min
  const filled = Math.min(Math.floor(n / (min / segments)), segments)
  return (
    <StatTile label={label} value={n} unit={`/ ${min}`} className="col-span-3 @2xl:col-span-1">
      <div className="mt-3 flex gap-1">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < filled ? (met ? 'bg-ink-900' : 'bg-wait') : 'bg-ink-200'}`} />
        ))}
      </div>
    </StatTile>
  )
}

function DefectTile({ label, title, n, total }: { label: string; title: string; n: number; total: number }) {
  return (
    <StatTile label={label} title={title} value={n} className="col-span-2 @2xl:col-span-1">
      <p className="mt-3 text-xs text-ink-600">{Math.round((n / total) * 100)} % riasiniek</p>
    </StatTile>
  )
}

function Distribution({ summary, interim }: { summary: TemDetails['summary']; interim: boolean }) {
  // Only classified cilia count here; non-evaluable ones are left out.
  const normalPct = Math.round((summary.normal / (summary.normal + summary.defective)) * 100)
  const parts = [
    { key: 'normal', n: summary.normal, bar: 'bg-ok' },
    { key: 'defective', n: summary.defective, bar: 'bg-bad' },
  ].filter((part) => part.n > 0)
  return (
    <div className="mt-4">
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[13px] text-ink-600">Celkové rozdelenie{interim ? ' (priebežné)' : ''}</span>
        <span className="num text-[13px]">{normalPct} % normálne / {100 - normalPct} % defektné</span>
      </div>
      <div className="mt-2 flex h-2.5 gap-1">
        {parts.map((part) => <span key={part.key} className={`rounded-full ${part.bar}`} style={{ flexGrow: part.n, flexBasis: 0 }} />)}
      </div>
    </div>
  )
}

// ---------- Low-cilia warning (F07) ----------

function LowCiliaWarning({ n, pendingImages, onAddNote, noteAdded, onShowPending }: {
  n: number; pendingImages: number; onAddNote: () => void; noteAdded: boolean; onShowPending: () => void
}) {
  const [why, setWhy] = useState(false)
  return (
    <div className="rounded-inner border border-ai-100 bg-ai-50 p-4">
      <div className="flex items-start gap-2.5">
        <AlertTriangle size={18} className="mt-px shrink-0 text-ai-600" />
        <div className="flex-1">
          <p className="font-semibold">Vyhodnotených je len {n} zo {MIN_CILIA} riasiniek</p>
          <p className="mt-1 text-[13px] text-ink-600">
            Záver môže byť menej spoľahlivý. {pendingImages > 0 ? `Nevyhodnotených snímok je ešte ${pendingImages}. ` : ''}
            Ak sa ďalšie riasinky vyhodnotiť nedajú, môže stáť za to uviesť to v správe.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {pendingImages > 0 && <Button size="sm" onClick={onShowPending}>Zobraziť nevyhodnotené snímky</Button>}
            <Button size="sm" variant="ai" onClick={onAddNote} disabled={noteAdded} className={noteAdded ? 'opacity-60' : ''}>
              {noteAdded ? <><Check size={14} /> Poznámka je v správe</> : <><Sparkles size={14} /> Doplniť poznámku do správy</>}
            </Button>
          </div>
          {why && (
            <p className="mt-3 rounded-inner bg-surface p-3 text-[13px] text-ink-600">
              Pravidlo oddelenia: na záver treba vyhodnotiť aspoň {MIN_CILIA} riasiniek (pri niektorých defektoch až 300).
              Upozornenie vychádza len z počtu anotácií v CiliaScane, nehodnotí kvalitu snímok.
            </p>
          )}
          <div className="mt-1 -ml-2"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>
        </div>
      </div>
    </div>
  )
}

// ---------- Report (F09) ----------

type ReportStatus = 'draft' | 'sent'

function initialReport(p: Patient, draft: string): { text: string; status: ReportStatus } {
  return reportSent(p) ? { text: draft, status: 'sent' } : { text: '', status: 'draft' }
}

// ---------- Tab ----------

type ImageFilter = 'all' | 'pending' | 'evaluated'
type ImageQuality = 'blurry' | 'sharp'

/** "1 snímku / 3 snímky / 11 snímok" (accusative, as in "Otvoriť …"). */
function imagesLabel(n: number) {
  if (n === 1) return '1 snímku'
  return n >= 2 && n <= 4 ? `${n} snímky` : `${n} snímok`
}

const IMAGE_PAGE_SIZE = 12 // 3 rows of 4

const QUALITY_OPTIONS: { value: ImageQuality; label: string }[] = [
  { value: 'blurry', label: 'Rozmazané' },
  { value: 'sharp', label: 'Ostré' },
]

export default function TemTab({ p }: { p: Patient }) {
  const { role } = useRole()
  const canEdit = role !== 'vojtech' // report is written by the lab
  const version = useStoreVersion()
  const generated = useMemo(() => temDetails(p), [p])
  const details = useMemo(
    () => ({ ...generated, images: [...(hasMockImages(p) ? generated.images : []), ...uploadedImages(p.id)] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generated, p, version],
  )
  const [uploading, setUploading] = useState(false)
  const aiDraftText = useMemo(() => draftReport(p, generated), [p, generated])

  const [selected, setSelected] = useState<string[]>([])
  const [imageFilter, setImageFilter] = useState<ImageFilter>('all')
  const [quality, setQuality] = useState<ImageQuality[]>([])
  const [imagePage, setImagePage] = useState(1)
  const [fullStats, setFullStats] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const init = initialReport(p, aiDraftText)
  const [report, setReport] = useState(init.text)
  const [status, setStatusState] = useState<ReportStatus>(init.status)
  const setStatus = (s: ReportStatus) => { setStatusState(s); setReportSent(p.id, s === 'sent') }
  const [aiDraft, setAiDraft] = useState<string | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [draftWhy, setDraftWhy] = useState(false)

  const n = details.evaluated
  const pendingImages = details.images.filter((i) => !i.evaluated).length
  const noteAdded = report.includes(LOW_CILIA_NOTE(n)) || (aiDraft?.includes(LOW_CILIA_NOTE(n)) ?? false)
  const maxCount = Math.max(...details.counts.map((c) => c.n), 1)
  const opened = openedImages(p.id)
  const candidates = details.images.filter((i) => !i.evaluated && !opened.includes(i.id))
  const project = `${p.id} · odber ${p.sampleNo}`
  const projectExists = details.images.length > candidates.length

  // Gallery: status filter + quality filter + sort, then one page of the result.
  const isOpened = (i: TemImage) => !i.evaluated && opened.includes(i.id)
  const qualityOf = (i: TemImage): ImageQuality => (i.blurry ? 'blurry' : 'sharp')
  const matchesStatus = (i: TemImage) => imageFilter === 'all' || i.evaluated === (imageFilter === 'evaluated')
  const matchesQuality = (i: TemImage) => quality.length === 0 || quality.includes(qualityOf(i))
  const images = details.images
    .filter((i) => matchesStatus(i) && matchesQuality(i))
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt) || a.id.localeCompare(b.id)) // always newest first
  const imagePageCount = Math.max(1, Math.ceil(images.length / IMAGE_PAGE_SIZE))
  const currentImagePage = Math.min(imagePage, imagePageCount)
  const pageImages = images.slice((currentImagePage - 1) * IMAGE_PAGE_SIZE, currentImagePage * IMAGE_PAGE_SIZE)
  useEffect(() => setImagePage(1), [imageFilter, quality])
  const allVisibleSelected = images.length > 0 && images.every((i) => selected.includes(i.id))
  const toggleAllVisible = () => {
    const ids = images.map((i) => i.id) // every filtered image, not only the current page
    setSelected((s) => (allVisibleSelected ? s.filter((id) => !ids.includes(id)) : [...new Set([...s, ...ids])]))
  }

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const suggest = () => {
    setDrafting(true)
    setTimeout(() => { setAiDraft(aiDraftText); setDrafting(false) }, 900)
  }
  const acceptDraft = () => { setReport(aiDraft ?? ''); setAiDraft(null); setDraftWhy(false) }
  const openImages = (ids: string[]) => {
    const fresh = ids.filter((id) => candidates.some((i) => i.id === id)) // images already in the project are not added twice
    if (fresh.length > 0) markOpened(p, fresh)
    setSelected([])
    if (fresh.length === 0) flash(`Otváram projekt ${project} v CiliaScane… (simulácia)`)
    else if (projectExists) flash(`Pridávam ${imagesLabel(fresh.length)} do projektu ${project}… (simulácia)`)
    else flash(`Otváram ${imagesLabel(fresh.length)} v novom projekte ${project}… (simulácia)`)
  }
  const pickManually = () => {
    setImageFilter('pending')
    setQuality([])
    document.getElementById('tem-images')?.scrollIntoView({ behavior: 'smooth' })
  }
  const addNote = () => {
    if (aiDraft != null) setAiDraft(`${aiDraft.trimEnd()}\n\n${LOW_CILIA_NOTE(n)}`)
    else setReport((r) => `${r.trimEnd()}${r.trim() ? '\n\n' : ''}${LOW_CILIA_NOTE(n)}`)
  }

  const worthOpening = candidates.some((i) => !i.blurry) // only blurry images left → no longer the main action
  const openButton = canEdit && details.images.length > 0 && (
    <Button size="sm" variant={worthOpening ? 'primary' : 'secondary'} onClick={() => openImages(details.images.map((i) => i.id))}>
      <ExternalLink size={14} /> Otvoriť všetky v CiliaScan
      <span className={`num rounded-full px-1.5 text-[11px] leading-[18px] ${worthOpening ? 'bg-white/15' : 'bg-surface-muted'}`}>{details.images.length}</span>
    </Button>
  )

  return (
    <div className="flex flex-col gap-6">
      {/* CiliaScan stats */}
      <section>
        <p className={sectionLabel}>Štatistiky z CiliaScanu</p>
        {n === 0 ? (
          <div className="hatch mt-3 rounded-inner p-6 text-center">
            <span className="rounded-md bg-surface px-3 py-1.5 text-[13px]">Snímky zatiaľ neboli vyhodnotené v CiliaScane</span>
          </div>
        ) : (
          <div className="@container mt-3">
            {/* 2 + 3 tiles when the AI panel narrows the tab, one row otherwise */}
            <div className="grid grid-cols-6 gap-3 @2xl:grid-cols-5">
              <MinimumTile label="Riasinky spolu" n={n} min={MIN_CILIA} />
              <MinimumTile label="S dyneínovými ramienkami" n={details.summary.dynein} min={MIN_DYNEIN_CILIA} />
              <DefectTile label="MTD" title="Mikrotubulárna dezorganizácia" n={details.summary.mtd} total={n} />
              <DefectTile label="IDA" title="Defekt vnútorných dyneínových ramienok (inner dynein arm)" n={details.summary.ida} total={n} />
              <DefectTile label="ODA" title="Defekt vonkajších dyneínových ramienok (outer dynein arm)" n={details.summary.oda} total={n} />
            </div>
            <Distribution summary={details.summary} interim={p.exams.tem.status === 'pending'} />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="ghost" aria-expanded={fullStats} onClick={() => setFullStats(!fullStats)}>
                <ChevronDown size={14} className={fullStats ? 'rotate-180' : ''} /> {fullStats ? 'Skryť celé štatistiky' : 'Zobraziť celé štatistiky'}
              </Button>
            </div>
            {fullStats && <div className="mt-2 space-y-2.5">
              {details.counts.map((c) => (
                <div key={c.category} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                  <span className="text-[13px]">{CATEGORY_LABEL[c.category]}</span>
                  <span className="num text-[13px] text-ink-600">{c.n} <span className="text-ink-400">· {Math.round((c.n / n) * 100)} %</span></span>
                  <div className="col-span-2 mt-1 h-2 rounded-full bg-surface-muted">
                    <div className={`h-2 rounded-full ${c.n === maxCount ? 'bg-ink-900' : 'bg-ink-200'}`} style={{ width: `${(c.n / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>}
          </div>
        )}
      </section>

      {n > 0 && n < MIN_CILIA && canEdit && (
        <LowCiliaWarning n={n} pendingImages={pendingImages} noteAdded={noteAdded} onAddNote={addNote}
          onShowPending={pickManually} />
      )}

      {/* Report */}
      <section className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className={sectionLabel}>Správa z TEM</p>
            {status === 'draft' && <span className="inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs font-medium text-ink-600">Rozpracované</span>}
          </div>
          {canEdit && status === 'draft' && aiDraft == null && n > 0 && (
            <Button size="sm" variant="aiSoft" onClick={suggest} disabled={drafting}>
              <Sparkles size={14} className={drafting ? 'animate-pulse' : ''} /> {drafting ? 'Pripravujem návrh…' : 'Navrhnúť správu'}
            </Button>
          )}
        </div>

        {aiDraft != null ? (
          <div className="mt-3 rounded-inner border border-ai-100 bg-ai-50 p-4">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-ai-700">
              <Sparkles size={14} /> Návrh správy od AI – skontroluj a uprav pred prijatím
            </div>
            <textarea value={aiDraft} onChange={(e) => setAiDraft(e.target.value)} rows={11}
              className="mt-3 w-full resize-y rounded-inner border border-ai-100 bg-surface p-3 text-[13px] leading-relaxed outline-none focus:ring-2 focus:ring-ai-100" />
            {draftWhy && (
              <div className="mt-3 rounded-inner bg-surface p-3 text-[13px] text-ink-600">
                <p className="font-medium text-ink-900">Návrh vychádza z:</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-5">{draftSources(details).map((s) => <li key={s}>{s}</li>)}</ul>
              </div>
            )}
            <div className="mt-3 flex items-center justify-between">
              <div className="-ml-2"><AiFeedback why={draftWhy} onWhy={() => setDraftWhy(!draftWhy)} /></div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => { setAiDraft(null); setDraftWhy(false) }}><X size={14} /> Zahodiť</Button>
                <Button size="sm" variant="primary" onClick={acceptDraft}><Check size={14} /> Prijať do správy</Button>
              </div>
            </div>
          </div>
        ) : canEdit && status === 'draft' ? (
          <textarea value={report} onChange={(e) => setReport(e.target.value)} rows={8}
            placeholder="Napíš správu alebo si nechaj navrhnúť text zo štatistík…"
            className="mt-3 w-full resize-y rounded-inner bg-surface-muted p-4 text-[13px] leading-relaxed outline-none placeholder:text-ink-400 focus:ring-2 focus:ring-border" />
        ) : report ? (
          <p className="mt-3 whitespace-pre-line rounded-inner bg-surface-muted p-4 text-[13px] leading-relaxed">{report}</p>
        ) : (
          <div className="hatch mt-3 rounded-inner p-6 text-center">
            <span className="rounded-md bg-surface px-3 py-1.5 text-[13px]">Správu zatiaľ píše laboratórium</span>
          </div>
        )}

        {canEdit && aiDraft == null && (
          <div className="mt-3 flex justify-end gap-2">
            {status === 'sent'
              ? <Button size="sm" onClick={() => setStatus('draft')}>Upraviť správu</Button>
              : <Button size="sm" variant={worthOpening ? 'secondary' : 'primary'} disabled={!report.trim()} className={!report.trim() ? 'opacity-40' : ''}
                  onClick={() => {
                    setStatus('sent')
                    notify({ type: 'report', patientId: p.id, tab: 'tem', to: recipients([p.owner, ...p.sharedWith], role), title: 'Nová správa z TEM', text: `Autor: ${ROLES[role].name} · ${ROLES[role].title}` })
                    flash(`Správa odoslaná – ${ROLES[p.owner].name} dostane notifikáciu`)
                  }}>
                  <Send size={14} /> Odoslať klinikovi
                </Button>}
          </div>
        )}
      </section>

      {/* Images */}
      <section id="tem-images" className="@container border-t border-border pt-6">
        {/* Title row: what to do with the images. Second row: what is shown. */}
        <div className="flex min-h-8 items-center justify-between gap-2">
          <p className={sectionLabel}>
            Snímky ({images.length < details.images.length ? `${images.length} z ${details.images.length}` : details.images.length})
          </p>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setUploading(true)}><Upload size={14} /> Nahrať snímky</Button>
              {openButton}
            </div>
          )}
        </div>

        {details.images.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Segmented<ImageFilter> value={imageFilter} onChange={setImageFilter} options={[
              { value: 'all', label: 'Všetky', count: details.images.length },
              { value: 'pending', label: 'Nevyhodnotené', count: pendingImages },
              { value: 'evaluated', label: 'Vyhodnotené', count: details.images.length - pendingImages },
            ]} />
            {canEdit && (
              <>
                <FilterMenu<ImageQuality> label="Kvalita" ai aiAlways multi options={QUALITY_OPTIONS} selected={quality} onChange={setQuality}
                  count={(q) => details.images.filter((i) => matchesStatus(i) && qualityOf(i) === q).length} />
                <Button size="sm" className={`ml-auto ${images.length === 0 ? 'opacity-40' : ''}`} disabled={images.length === 0} onClick={toggleAllVisible}>
                  <CheckCheck size={14} /> {allVisibleSelected ? 'Zrušiť označenie' : `Označiť všetky (${images.length})`}
                </Button>
              </>
            )}
          </div>
        )}


        {details.images.length === 0 && (
          <div className="hatch mt-4 rounded-inner p-8 text-center">
            <span className="rounded-md bg-surface px-3 py-1.5 text-[13px]">Zatiaľ neboli nahrané žiadne snímky</span>
          </div>
        )}

        <div className="relative mt-4 grid grid-cols-3 gap-3 @2xl:grid-cols-4">
          {details.images.length > 0 && images.length === 0 && (
            <div className="hatch absolute inset-x-0 top-0 rounded-inner p-8 text-center">
              <span className="rounded-md bg-surface px-3 py-1.5 text-[13px]">Tomuto filtru nezodpovedá žiadna snímka</span>
            </div>
          )}
          {pageImages.map((img) => {
            const isSel = selected.includes(img.id)
            const flagged = canEdit && img.blurry && !isOpened(img)
            return (
              <button key={img.id} onClick={() => toggle(img.id)} disabled={!canEdit}
                className={`group relative overflow-hidden rounded-inner text-left ${canEdit ? 'cursor-pointer' : ''} ${isSel ? 'ring-2 ring-ink-900 ring-offset-2' : ''}`}>
                <div className="aspect-[4/3]"><TemThumb img={img} /></div>
                {canEdit && (
                  <span className={`absolute top-2 left-2 flex size-5 items-center justify-center rounded-md border ${
                    isSel ? 'border-ink-900 bg-ink-900 text-white' : 'border-white/80 bg-white/70 opacity-0 group-hover:opacity-100'
                  }`}>
                    {isSel && <Check size={12} strokeWidth={3} />}
                  </span>
                )}
                <div className="flex items-center justify-between bg-surface-muted px-2.5 pt-1.5 text-[11px]">
                  <span className="font-mono font-medium">{img.id}</span>
                  {flagged
                    ? <span title="AI: rozmazaná – návrh ju pri otváraní v CiliaScane vynechá" className="flex items-center gap-1 text-ai-600"><Sparkles size={11} /> rozmazaná</span>
                    : img.evaluated
                      ? <span className="flex items-center gap-1 text-ink-600"><Check size={11} /> vyhodnotená</span>
                      : <span className={isOpened(img) ? 'text-ink-600' : 'text-ink-400'}>{isOpened(img) ? 'v CiliaScane' : 'nevyhodnotená'}</span>}
                </div>
                <p className="num bg-surface-muted px-2.5 pb-1.5 text-[11px] text-ink-400">{formatDate(img.uploadedAt)}</p>
              </button>
            )
          })}
          {/* Fixed height per patient, so filtering or paging down to a few images doesn't move the UI. */}
          {Array.from({ length: Math.min(IMAGE_PAGE_SIZE, details.images.length) - pageImages.length }, (_, i) => (
            <div key={i} className="invisible" aria-hidden>
              <div className="aspect-[4/3]" />
              <p className="px-2.5 py-1.5 text-[11px]">&nbsp;<br />&nbsp;</p>
            </div>
          ))}
        </div>

        {details.images.length > IMAGE_PAGE_SIZE && (
          <div className="mt-4 min-h-8">
            {imagePageCount > 1 && (
              <Pagination className="justify-end" page={currentImagePage} pageCount={imagePageCount} pageSize={IMAGE_PAGE_SIZE} total={images.length} onChange={setImagePage} />
            )}
          </div>
        )}

        {/* Floating selection bar */}
        {canEdit && selected.length > 0 && (
          <div className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-ink-900 py-1.5 pr-1.5 pl-5 text-white shadow-pop">
            <span className="num text-[13px] font-medium">Vybraté: {selected.length}</span>
            <span className="mx-1 h-4 w-px bg-white/20" />
            <button onClick={() => setSelected([])} className="h-8 rounded-full px-3 text-[13px] text-white/70 hover:text-white cursor-pointer">Zrušiť</button>
            <button onClick={() => openImages(selected)}
              className="inline-flex h-8 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-ink-900 cursor-pointer">
              <ExternalLink size={14} /> Otvoriť {imagesLabel(selected.length)} v CiliaScan
            </button>
          </div>
        )}
      </section>

      {uploading && <TemUploadModal p={p} startIndex={details.images.length} onClose={() => setUploading(false)} />}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-ink-900 px-5 py-2.5 text-[13px] text-white shadow-pop">{toast}</div>
      )}
    </div>
  )
}
