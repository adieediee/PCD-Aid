import { useMemo, useState } from 'react'
import { AlertTriangle, Check, ExternalLink, RefreshCw, Send, Sparkles, Upload, X } from 'lucide-react'
import { Button, Segmented } from './ui'
import { AiFeedback } from './AiPanel'
import { MIN_CILIA, mulberry32 } from '../data/patients'
import { CATEGORY_LABEL, temDetails, type TemImage } from '../data/tem'
import { LOW_CILIA_NOTE, draftReport, draftSources } from '../ai/report'
import { ROLES } from '../labels'
import { useRole } from '../role'
import { TemUploadModal } from './Forms'
import { notify, recipients } from '../notifications'
import { hasMockImages, reportSent, setReportSent, uploadedImages, useStoreVersion } from '../store'
import type { Patient } from '../types'

const sectionLabel = 'text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400'

// ---------- Mock TEM thumbnail (9+2 axoneme cross-sections) ----------

function TemThumb({ img }: { img: TemImage }) {
  const rand = mulberry32(img.seed)
  const axonemes = Array.from({ length: 4 + Math.floor(rand() * 3) }, () => ({ x: 14 + rand() * 92, y: 12 + rand() * 66, r: 9 + rand() * 3 }))
  const fid = `blur-${img.id}-${img.seed}`
  return (
    <svg viewBox="0 0 120 90" className="block h-full w-full" aria-hidden>
      <defs><filter id={fid}><feGaussianBlur stdDeviation="1.6" /></filter></defs>
      <rect width="120" height="90" fill="#C9CBCF" />
      <g filter={img.blurry ? `url(#${fid})` : undefined}>
        {axonemes.map((a, i) => (
          <g key={i}>
            <circle cx={a.x} cy={a.y} r={a.r} fill="#B3B6BC" stroke="#6B6F78" strokeWidth="0.8" />
            {Array.from({ length: 9 }, (_, k) => {
              const ang = (k / 9) * Math.PI * 2
              return <circle key={k} cx={a.x + Math.cos(ang) * a.r * 0.7} cy={a.y + Math.sin(ang) * a.r * 0.7} r={1.3} fill="#3F434B" />
            })}
            <circle cx={a.x - 1.4} cy={a.y} r={1.1} fill="#3F434B" />
            <circle cx={a.x + 1.4} cy={a.y} r={1.1} fill="#3F434B" />
          </g>
        ))}
      </g>
    </svg>
  )
}

// ---------- Stats ----------

function CiliaProgress({ n }: { n: number }) {
  const segments = 10
  const filled = Math.min(Math.floor(n / (MIN_CILIA / segments)), segments)
  return (
    <div>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[40px] leading-none tracking-[-0.02em]">{n}</span>
        <span className="text-sm text-ink-400">/ {MIN_CILIA} riasiniek</span>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: segments }, (_, i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${i < filled ? (n >= MIN_CILIA ? 'bg-ink-900' : 'bg-wait') : 'bg-ink-200'}`} />
        ))}
      </div>
      <p className={`mt-2 text-xs ${n >= MIN_CILIA ? 'text-ink-600' : 'font-medium text-wait'}`}>
        {n >= MIN_CILIA ? 'Minimum na vyhodnotenie splnené' : `Do minima chýba ${MIN_CILIA - n} riasiniek`}
      </p>
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

type ImageFilter = 'all' | 'evaluated' | 'pending'

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
  const images = details.images.filter((i) => imageFilter === 'all' || (imageFilter === 'evaluated' ? i.evaluated : !i.evaluated))
  const noteAdded = report.includes(LOW_CILIA_NOTE(n)) || (aiDraft?.includes(LOW_CILIA_NOTE(n)) ?? false)
  const maxCount = Math.max(...details.counts.map((c) => c.n), 1)

  const flash = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2500) }
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  const suggest = () => {
    setDrafting(true)
    setTimeout(() => { setAiDraft(aiDraftText); setDrafting(false) }, 900)
  }
  const acceptDraft = () => { setReport(aiDraft ?? ''); setAiDraft(null); setDraftWhy(false) }
  const addNote = () => {
    if (aiDraft != null) setAiDraft(`${aiDraft.trimEnd()}\n\n${LOW_CILIA_NOTE(n)}`)
    else setReport((r) => `${r.trimEnd()}${r.trim() ? '\n\n' : ''}${LOW_CILIA_NOTE(n)}`)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* CiliaScan stats */}
      <section>
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Štatistiky z CiliaScanu</p>
          <span className="flex items-center gap-1.5 text-xs text-ink-400"><RefreshCw size={12} /> synchronizované {details.syncedAt}</span>
        </div>
        {n === 0 ? (
          <div className="hatch mt-3 rounded-inner p-6 text-center">
            <span className="rounded-md bg-surface px-3 py-1.5 text-[13px]">Snímky zatiaľ neboli vyhodnotené v CiliaScane</span>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-[220px_1fr] gap-8">
            <CiliaProgress n={n} />
            <div className="space-y-2.5">
              {details.counts.map((c) => (
                <div key={c.category} className="grid grid-cols-[1fr_auto] items-center gap-x-3">
                  <span className="text-[13px]">{CATEGORY_LABEL[c.category]}</span>
                  <span className="num text-[13px] text-ink-600">{c.n} <span className="text-ink-400">· {Math.round((c.n / n) * 100)} %</span></span>
                  <div className="col-span-2 mt-1 h-2 rounded-full bg-surface-muted">
                    <div className={`h-2 rounded-full ${c.n === maxCount ? 'bg-ink-900' : 'bg-ink-200'}`} style={{ width: `${(c.n / maxCount) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {n > 0 && n < MIN_CILIA && canEdit && (
        <LowCiliaWarning n={n} pendingImages={pendingImages} noteAdded={noteAdded} onAddNote={addNote}
          onShowPending={() => { setImageFilter('pending'); document.getElementById('tem-images')?.scrollIntoView({ behavior: 'smooth' }) }} />
      )}

      {/* Report */}
      <section className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className={sectionLabel}>Správa z TEM</p>
            {status === 'sent'
              ? <span className="inline-flex h-6 items-center gap-1.5 rounded-full bg-ok-bg px-2.5 text-xs font-medium text-ok"><Check size={12} /> Odoslané – {ROLES[p.owner].name}</span>
              : <span className="inline-flex h-6 items-center rounded-full border border-border px-2.5 text-xs font-medium text-ink-600">Rozpracované</span>}
          </div>
          {canEdit && status === 'draft' && aiDraft == null && n > 0 && (
            <Button size="sm" variant="ai" onClick={suggest} disabled={drafting}>
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
              : <Button size="sm" variant="primary" disabled={!report.trim()} className={!report.trim() ? 'opacity-40' : ''}
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
      <section id="tem-images" className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <p className={sectionLabel}>Snímky ({details.images.length})</p>
          <div className="flex items-center gap-2">
            <Segmented<ImageFilter> value={imageFilter} onChange={setImageFilter} options={[
              { value: 'all', label: 'Všetky', count: details.images.length },
              { value: 'evaluated', label: 'Vyhodnotené', count: details.images.length - pendingImages },
              { value: 'pending', label: 'Nevyhodnotené', count: pendingImages },
            ]} />
            {canEdit && <Button size="sm" onClick={() => setUploading(true)}><Upload size={14} /> Nahrať snímky</Button>}
          </div>
        </div>

        {details.images.length === 0 && (
          <div className="hatch mt-4 rounded-inner p-8 text-center">
            <span className="rounded-md bg-surface px-3 py-1.5 text-[13px]">Zatiaľ neboli nahrané žiadne snímky</span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-3">
          {images.map((img) => {
            const isSel = selected.includes(img.id)
            return (
              <button key={img.id} onClick={() => toggle(img.id)}
                className={`group relative overflow-hidden rounded-inner text-left cursor-pointer ${isSel ? 'ring-2 ring-ink-900 ring-offset-2' : ''}`}>
                <div className="aspect-[4/3]"><TemThumb img={img} /></div>
                <span className={`absolute top-2 left-2 flex size-5 items-center justify-center rounded-md border ${
                  isSel ? 'border-ink-900 bg-ink-900 text-white' : 'border-white/80 bg-white/70 opacity-0 group-hover:opacity-100'
                }`}>
                  {isSel && <Check size={12} strokeWidth={3} />}
                </span>
                <div className="flex items-center justify-between bg-surface-muted px-2.5 py-1.5 text-[11px]">
                  <span className="font-mono font-medium">{img.id}</span>
                  {img.evaluated
                    ? <span className="num text-ink-600">{img.cilia} riasiniek</span>
                    : <span className={img.blurry ? 'text-wait' : 'text-ink-400'}>{img.blurry ? 'neostrá' : 'nevyhodnotená'}</span>}
                </div>
              </button>
            )
          })}
        </div>

        {/* Floating selection bar */}
        {selected.length > 0 && (
          <div className="sticky bottom-4 z-20 mx-auto mt-4 flex w-fit items-center gap-2 rounded-full bg-ink-900 py-1.5 pr-1.5 pl-5 text-white shadow-pop">
            <span className="num text-[13px] font-medium">Vybraté: {selected.length}</span>
            <span className="mx-1 h-4 w-px bg-white/20" />
            <button onClick={() => setSelected([])} className="h-8 rounded-full px-3 text-[13px] text-white/70 hover:text-white cursor-pointer">Zrušiť</button>
            <button onClick={() => { flash(`Otváram ${selected.length} snímok v CiliaScane… (simulácia)`); setSelected([]) }}
              className="inline-flex h-8 items-center gap-2 rounded-full bg-white px-4 text-[13px] font-medium text-ink-900 cursor-pointer">
              <ExternalLink size={14} /> Otvoriť v CiliaScan
            </button>
          </div>
        )}
        {selected.length === 0 && details.images.length > 0 && (
          <div className="mt-4 flex justify-center">
            <Button onClick={() => flash('Otváram CiliaScan… (simulácia)')}><ExternalLink size={16} /> Otvoriť všetky v CiliaScan</Button>
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
