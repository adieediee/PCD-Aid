import { useRef, useState, type DragEvent, type ReactNode } from 'react'
import { Check, ImagePlus, Plus, Upload, X } from 'lucide-react'
import { Button, Field, Modal, Segmented, inputClass } from './ui'
import {
  CLINICAL_INDEX_ITEMS, EMPTY_ANAMNESIS, NNO_THRESHOLD, PATIENTS, PICADAR_CUTOFF, PICADAR_MAX, TODAY, clinicalIndexScore, picadarScore,
} from '../data/patients'
import { PATIENT_STATUS } from '../labels'
import { addPatient, addUploadedImages, nextPatientId, recordNno, saveAnamnesis } from '../store'
import { useRole } from '../role'
import { notify, recipients } from '../notifications'
import { ROLES } from '../labels'
import type { Anamnesis, Patient, PatientStatus, Situs } from '../types'

// Forms following Majka's user flows: 1 add patient, 2 record nNO, 3 upload TEM images (+ anamnesis transcription).

// ---------- Flow 1: Add new patient ----------

type PatientErrors = Partial<Record<'id' | 'sampleNo' | 'birthYear', string>>

export function AddPatientModal({ onClose, onAdded }: { onClose: () => void; onAdded: (id: string) => void }) {
  const { role } = useRole()
  const [id, setId] = useState(nextPatientId())
  const [sampleNo, setSampleNo] = useState('1')
  const [birthYear, setBirthYear] = useState('')
  const [status, setStatus] = useState<PatientStatus>('diagnostics')
  const [errors, setErrors] = useState<PatientErrors>({})

  const validate = (): PatientErrors => {
    const e: PatientErrors = {}
    const normId = id.trim().toUpperCase()
    if (!/^PCD-\d{4}$/.test(normId)) e.id = 'Formát ID je PCD-0000.'
    else if (PATIENTS.some((p) => p.id === normId)) e.id = 'Pacient s týmto ID už existuje.'
    const s = Number(sampleNo)
    if (!sampleNo.trim() || !Number.isInteger(s) || s < 1) e.sampleNo = 'Zadaj číslo odberu (1, 2, …).'
    const y = Number(birthYear)
    if (!birthYear.trim()) e.birthYear = 'Rok narodenia je povinný.'
    else if (!Number.isInteger(y) || y < 1920 || y > TODAY.getFullYear()) e.birthYear = `Zadaj rok medzi 1920 a ${TODAY.getFullYear()}.`
    return e
  }

  // Majka's flow: fill required fields → are they filled correctly? → no: back to fields / yes: submit.
  const submit = () => {
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    const normId = id.trim().toUpperCase()
    addPatient({ id: normId, sampleNo: Number(sampleNo), birthYear: Number(birthYear), status, owner: role })
    onAdded(normId)
  }

  return (
    <Modal title="Pridať pacienta" subtitle="Pacient je v aplikácii len pod identifikátorom – bez mena a rodného čísla." onClose={onClose}>
      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="grid grid-cols-2 gap-4">
          <Field label="ID pacienta" hint="Predvyplnené ďalšie voľné číslo" error={errors.id}>
            <input value={id} onChange={(e) => setId(e.target.value)} className={`${inputClass(errors.id)} font-mono`} />
          </Field>
          <Field label="Číslo odberu" error={errors.sampleNo}>
            <input value={sampleNo} onChange={(e) => setSampleNo(e.target.value)} inputMode="numeric" className={`${inputClass(errors.sampleNo)} num`} />
          </Field>
          <Field label="Rok narodenia" error={errors.birthYear}>
            <input value={birthYear} onChange={(e) => setBirthYear(e.target.value)} inputMode="numeric" placeholder="napr. 2019" className={`${inputClass(errors.birthYear)} num`} autoFocus />
          </Field>
        </div>
        <Field label="Stav">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(PATIENT_STATUS) as PatientStatus[]).map((s) => (
              <button type="button" key={s} onClick={() => setStatus(s)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium cursor-pointer ${
                  status === s ? 'border-ink-900 bg-ink-900 text-white' : 'border-border hover:bg-surface-muted'
                }`}>
                <span className={`size-1.5 rounded-full ${status === s ? 'bg-white' : PATIENT_STATUS[s].dot}`} />
                {PATIENT_STATUS[s].label}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex justify-end gap-2 border-t border-border pt-5">
          <Button type="button" onClick={onClose}>Zrušiť</Button>
          <Button type="submit" variant="primary"><Plus size={16} /> Pridať pacienta</Button>
        </div>
      </form>
    </Modal>
  )
}

// ---------- Anamnesis ----------
// The pediatrician takes the anamnesis in UNIS / on a paper questionnaire; copying it here is optional.
// Scores are computed from the answers, so the doctor sees PICADAR while filling it in.

type YesNoKey = { [K in keyof Anamnesis]: Anamnesis[K] extends boolean ? K : never }[keyof Anamnesis]

const ANAMNESIS_GROUPS: { title: string; items: { key: YesNoKey; label: string }[] }[] = [
  { title: 'Novorodenecké obdobie', items: [
    { key: 'fullTerm', label: 'Narodenie v termíne' },
    { key: 'neonatalRds', label: 'RDS novorodenca' },
    { key: 'nicu', label: 'Hospitalizácia na JIS' },
  ] },
  { title: 'Príznaky', items: [
    { key: 'wetCough', label: 'Denný vlhký kašeľ' },
    { key: 'rhinitis', label: 'Chronická rinitída' },
    { key: 'otitis', label: 'Ušné / sluchové problémy' },
  ] },
  { title: 'Ďalšie', items: [
    { key: 'heartDefect', label: 'Vrodená srdcová vada' },
    { key: 'familyPcd', label: 'PCD v rodine' },
  ] },
]

const SITUS_OPTIONS: { value: Situs; label: string }[] = [
  { value: 'solitus', label: 'Solitus' },
  { value: 'inversus', label: 'Inversus' },
  { value: 'ambiguus', label: 'Heterotaxia' },
]
const YES_NO: { value: 'yes' | 'no'; label: string }[] = [{ value: 'yes', label: 'Áno' }, { value: 'no', label: 'Nie' }]

function AnswerRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13px]">{label}</span>
      {children}
    </div>
  )
}

export function AnamnesisModal({ p, onClose }: { p: Patient; onClose: () => void }) {
  const { role } = useRole()
  const [a, setA] = useState<Anamnesis>(p.anamnesis ?? EMPTY_ANAMNESIS)
  const [siblings, setSiblings] = useState(String(a.siblings))
  const set = <K extends keyof Anamnesis>(key: K, value: Anamnesis[K]) => setA((x) => ({ ...x, [key]: value }))
  const sib = Number(siblings)
  const sibError = siblings.trim() === '' || !Number.isInteger(sib) || sib < 0 || sib > 15 ? 'Zadaj počet 0–15.' : undefined
  const final: Anamnesis = { ...a, nicu: a.neonatalRds && a.nicu, siblings: sibError ? 0 : sib }
  const picadar = picadarScore(final)

  const submit = () => {
    if (sibError) return
    saveAnamnesis(p, final)
    notify({ type: 'results', patientId: p.id, tab: 'anamnesis', to: recipients(p.sharedWith, role),
      title: p.anamnesis ? 'Upravená anamnéza' : 'Zapísaná anamnéza', text: `PICADAR ${picadar ?? '–'} · ${ROLES[role].name}` })
    onClose()
  }

  return (
    <Modal title={`Anamnéza · ${p.id}`} width="max-w-2xl" onClose={onClose}
      subtitle="Prepíš z UNIS alebo z dotazníka. Nie je povinná – bez nej sa však nevypočíta PICADAR a pacient sa neporovná s podobnými podľa anamnézy.">
      <div className="mt-6">
        <AnswerRow label="Poloha orgánov (situs)">
          <Segmented<Situs> value={a.situs} options={SITUS_OPTIONS} onChange={(v) => set('situs', v)} />
        </AnswerRow>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-5">
        {ANAMNESIS_GROUPS.map((g) => (
          <div key={g.title}>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">{g.title}</p>
            {g.items.filter((i) => i.key !== 'nicu' || a.neonatalRds).map((i) => (
              <AnswerRow key={i.key} label={i.label}>
                <Segmented value={a[i.key] ? 'yes' : 'no'} options={YES_NO} onChange={(v) => set(i.key, v === 'yes')} />
              </AnswerRow>
            ))}
            {g.title === 'Ďalšie' && (
              <AnswerRow label="Počet súrodencov">
                <input value={siblings} onChange={(e) => setSiblings(e.target.value)} inputMode="numeric" aria-invalid={!!sibError}
                  className={`${inputClass(sibError)} num w-20 text-center`} />
              </AnswerRow>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-x-6 gap-y-1 rounded-inner bg-surface-muted px-4 py-3 text-[13px]">
        <span>
          PICADAR{' '}
          {picadar != null ? (
            <>
              <span className="num font-semibold">{picadar}</span><span className="text-ink-400">/{PICADAR_MAX}</span>
              {picadar >= PICADAR_CUTOFF && <span className="text-ink-600"> · ≥ {PICADAR_CUTOFF} = odporúčané ďalšie vyšetrenie</span>}
            </>
          ) : <span className="text-ink-600">neaplikuje sa (bez denného vlhkého kašľa)</span>}
        </span>
        <span>
          Klinický index <span className="num font-semibold">{clinicalIndexScore(final)}</span><span className="text-ink-400">/{CLINICAL_INDEX_ITEMS.length}</span>
        </span>
      </div>

      <div className="mt-5 flex justify-end gap-2 border-t border-border pt-5">
        <Button type="button" onClick={onClose}>Zrušiť</Button>
        <Button type="button" variant="primary" onClick={submit}><Check size={16} /> Uložiť anamnézu</Button>
      </div>
    </Modal>
  )
}

// ---------- Flow 2: Record nNO ----------

export function NnoForm({ p, onDone, onCancel }: { p: Patient; onDone: () => void; onCancel?: () => void }) {
  const { role } = useRole()
  const [value, setValue] = useState(p.exams.nno.value != null ? String(p.exams.nno.value) : '')
  const [error, setError] = useState<string>()
  const n = Number(value)
  const valid = value.trim() !== '' && Number.isFinite(n) && n >= 0 && n <= 3000

  const submit = () => {
    if (!valid) { setError(value.trim() ? 'Zadaj hodnotu medzi 0 a 3000 ppb.' : 'Hodnota nNO je povinná.'); return }
    recordNno(p, Math.round(n), NNO_THRESHOLD)
    notify({ type: 'results', patientId: p.id, tab: 'nno', to: recipients(['michaela', 'lucia', ...p.sharedWith], role),
      title: `Zapísané nNO: ${Math.round(n)} ppb`, text: `${n < NNO_THRESHOLD ? 'Pod' : 'Nad'} hranicou ${NNO_THRESHOLD} ppb · ${ROLES[role].name}` })
    onDone()
  }

  return (
    <form className="max-w-sm" onSubmit={(e) => { e.preventDefault(); submit() }}>
      <Field label="Nameraná hodnota nNO" error={error}
        hint={valid ? `${n < NNO_THRESHOLD ? 'Pod' : 'Nad'} hranicou ${NNO_THRESHOLD} ppb → ${n < NNO_THRESHOLD ? 'mimo normy' : 'v norme'}` : `Hranica ${NNO_THRESHOLD} ppb`}>
        <div className="relative">
          <input value={value} onChange={(e) => { setValue(e.target.value); setError(undefined) }} inputMode="numeric" autoFocus
            placeholder="0" className={`${inputClass(error)} num pr-14`} />
          <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-sm text-ink-400">ppb</span>
        </div>
      </Field>
      <div className="mt-4 flex gap-2">
        <Button type="submit" variant="primary"><Check size={16} /> Uložiť meranie</Button>
        {onCancel && <Button type="button" onClick={onCancel}>Zrušiť</Button>}
      </div>
    </form>
  )
}

// ---------- Flow 3: Upload TEM images ----------

interface PickedFile { name: string; size: number }

const DEMO_SIZE = 8_000_000 // ~8 MB per TEM image (per the PhD student)
const formatSize = (b: number) => (b >= 1_000_000 ? `${(b / 1_000_000).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(b / 1000))} kB`)

export function TemUploadModal({ p, startIndex, onClose }: { p: Patient; startIndex: number; onClose: () => void }) {
  const { role } = useRole()
  const inputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<PickedFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [progress, setProgress] = useState<number[] | null>(null) // null = still selecting
  const done = progress != null && progress.every((x) => x >= 100)

  const add = (list: FileList | null) => {
    if (!list) return
    const picked = [...list].map((f) => ({ name: f.name, size: f.size }))
    setFiles((fs) => [...fs, ...picked.filter((f) => !fs.some((x) => x.name === f.name))])
  }
  const addDemo = () => {
    const base = startIndex + files.length
    setFiles((fs) => [...fs, ...Array.from({ length: 6 }, (_, i) => ({ name: `${p.id}_${String(base + i + 1).padStart(3, '0')}.tif`, size: DEMO_SIZE + i * 137_000 }))])
  }
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragOver(false); add(e.dataTransfer.files) }

  // Simulated upload: files go one after another, each takes a moment (large TIFFs).
  const upload = () => {
    const pr = files.map(() => 0)
    setProgress([...pr])
    let i = 0
    const tick = () => {
      pr[i] = Math.min(pr[i] + 20, 100)
      if (pr[i] >= 100) i++
      setProgress([...pr])
      if (i < files.length) setTimeout(tick, 120)
      else {
        addUploadedImages(p, files.map((f) => f.name), startIndex)
        notify({ type: 'images', patientId: p.id, tab: 'tem', to: recipients(['michaela', 'lucia', p.owner], role),
          title: `Nové snímky z TEM (${files.length})`, text: `Nahrané: ${ROLES[role].name} · snímky čakajú na vyhodnotenie v CiliaScane` })
      }
    }
    setTimeout(tick, 120)
  }

  const total = files.reduce((s, f) => s + f.size, 0)
  const uploadedCount = progress?.filter((x) => x >= 100).length ?? 0

  return (
    <Modal title="Nahrať snímky z TEM" subtitle={`${p.id} · odber ${p.sampleNo}`} width="max-w-xl" onClose={progress && !done ? () => {} : onClose}>
      {progress == null && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
          className={`mt-6 flex flex-col items-center rounded-inner border-2 border-dashed px-6 py-8 text-center transition-colors ${dragOver ? 'border-ink-900 bg-surface-muted' : 'border-border'}`}
        >
          <ImagePlus size={28} className="text-ink-400" />
          <p className="mt-3 font-medium">{files.length ? 'Pridať ďalšie snímky' : 'Pretiahni snímky sem'}</p>
          <p className="mt-1 text-xs text-ink-600">TIFF, JPG alebo PNG</p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => inputRef.current?.click()}><Upload size={14} /> Vybrať zo zariadenia</Button>
            <Button size="sm" variant="ghost" onClick={addDemo}>Ukážkové snímky</Button>
          </div>
          <input ref={inputRef} type="file" multiple accept=".tif,.tiff,image/*" className="hidden" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
        </div>
      )}

      {files.length > 0 && (
        <div className="mt-5">
          <div className="flex items-baseline justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">
              {progress == null ? `Vybraté snímky (${files.length})` : done ? `Nahraté (${files.length})` : `Nahrávam ${uploadedCount + 1} z ${files.length}`}
            </p>
            <span className="num text-xs text-ink-600">{formatSize(total)}</span>
          </div>
          <ul className="mt-2 max-h-64 divide-y divide-border overflow-y-auto rounded-inner border border-border">
            {files.map((f, i) => (
              <li key={f.name} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                <span className="min-w-0 flex-1 truncate font-mono">{f.name}</span>
                {progress == null ? (
                  <>
                    <span className="num text-xs text-ink-400">{formatSize(f.size)}</span>
                    <button aria-label="Odobrať" onClick={() => setFiles(files.filter((x) => x.name !== f.name))}
                      className="flex size-6 items-center justify-center rounded-full text-ink-600 hover:bg-surface-muted cursor-pointer"><X size={14} /></button>
                  </>
                ) : progress[i] >= 100 ? (
                  <Check size={16} className="text-ok" />
                ) : (
                  <span className="h-1.5 w-24 rounded-full bg-surface-muted">
                    <span className="block h-1.5 rounded-full bg-ink-900 transition-all" style={{ width: `${progress[i]}%` }} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2 border-t border-border pt-5">
        <p className="text-xs text-ink-600">
          {done ? 'Snímky sú v TEM tabe ako nevyhodnotené.' : progress ? 'Nezatváraj okno, kým sa nahrávanie nedokončí.' : ''}
        </p>
        <div className="flex gap-2">
          {progress == null && <Button onClick={onClose}>Zrušiť</Button>}
          {progress == null && (
            <Button variant="primary" disabled={!files.length} onClick={upload} className="disabled:cursor-not-allowed disabled:opacity-40">
              <Upload size={16} /> Nahrať {files.length || ''} {files.length === 1 ? 'snímku' : files.length > 1 && files.length < 5 ? 'snímky' : 'snímok'}
            </Button>
          )}
          {done && <Button variant="primary" onClick={onClose}>Hotovo</Button>}
        </div>
      </div>
    </Modal>
  )
}
