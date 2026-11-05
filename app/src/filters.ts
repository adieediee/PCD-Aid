import { DEFECT_LABEL, PATIENT_STATUS } from './labels'
import { reportSent } from './store'
import { MIN_CILIA, NNO_THRESHOLD, PICADAR_CUTOFF, STALE_DAYS, ageOf, idleDays, isStale } from './data/patients'
import type { Patient, PatientStatus, RoleId, TemDefect } from './types'

// What to filter is based on the research synthesis: daily = ID + status + defect, research = anamnesis & co.
// Daily work ("what waits for me") is handled by role-based queues, not by filters.

export interface Filters {
  queue: QueueId | null
  statuses: PatientStatus[]
  defects: TemDefect[]
  // "Ďalšie filtre" panel – finding similar / research cases
  laterality: boolean
  rds: boolean
  heart: boolean
  family: boolean
  nno: 'low' | 'normal' | null
  picadar: 'high' | 'low' | null
  age: 'child' | 'adult' | null
  ageAtDx: 'infant' | 'child' | 'adult' | null
  siblings: 'none' | 'some' | null
  // Set only by F02 (sentence search); shown as chips
  genetics: 'missing' | null
  stale: boolean
}

export type FilterKey = keyof Filters

export const EMPTY_FILTERS: Filters = {
  queue: null,
  statuses: [],
  defects: [],
  laterality: false,
  rds: false,
  heart: false,
  family: false,
  nno: null,
  picadar: null,
  age: null,
  ageAtDx: null,
  siblings: null,
  genetics: null,
  stale: false,
}

// ---------- Role-based work queues ("Moja práca") ----------

export type QueueId = 'temToEvaluate' | 'lowCilia' | 'reportMissing' | 'readyForConclusion' | 'recent' | 'unclear' | 'stale' | 'temToPrepare' | 'normalTemSuspicion'

const open = (p: Patient) => p.status === 'diagnostics' || p.status === 'unclear'
const EXAMS = ['nno', 'hsvm', 'tem', 'if', 'genetics'] as const
const reportMissing = (p: Patient) => !reportSent(p) && p.exams.tem.ciliaCount != null && p.exams.tem.status !== 'pending'

export const QUEUES: Record<QueueId, { label: string; hint: string; test: (p: Patient) => boolean }> = {
  temToEvaluate: { label: 'Snímky na vyhodnotenie', hint: 'TEM čaká na vyhodnotenie v CiliaScane', test: (p) => p.exams.tem.status === 'pending' },
  lowCilia: { label: `Menej ako ${MIN_CILIA} riasiniek`, hint: 'záver by bol menej spoľahlivý', test: (p) => p.exams.tem.ciliaCount != null && p.exams.tem.ciliaCount < MIN_CILIA },
  reportMissing: { label: 'Správa z TEM chýba', hint: 'vyhodnotené, správa neodoslaná', test: (p) => reportMissing(p) },
  readyForConclusion: {
    label: 'Pripravené na záver', hint: 'všetky výsledky sú k dispozícii',
    test: (p) => open(p) && EXAMS.every((k) => p.exams[k].status !== 'pending') && p.exams.tem.status !== 'notDone' && !reportMissing(p),
  },
  recent: { label: 'Aktivita za posledný týždeň', hint: 'posledná zmena do 7 dní', test: (p) => open(p) && idleDays(p) <= 7 },
  unclear: { label: 'Nejasné prípady', hint: 'výsledky si navzájom odporujú', test: (p) => p.status === 'unclear' },
  stale: { label: `Stojí > ${STALE_DAYS / 7} týždne`, hint: 'bez aktivity', test: isStale },
  temToPrepare: { label: 'Na prípravu TEM / IF', hint: 'vzorka čaká na laboratórium', test: (p) => open(p) && (p.exams.tem.status === 'notDone' || p.exams.if.status === 'pending') },
  normalTemSuspicion: {
    label: 'Normálny TEM, ale podozrenie', hint: 'nízke nNO alebo abnormálne HSVM',
    test: (p) => p.exams.tem.defect === 'normal' && ((p.exams.nno.value != null && p.exams.nno.value < NNO_THRESHOLD) || p.exams.hsvm.status === 'abnormal'),
  },
}

export const ROLE_QUEUES: Record<RoleId, QueueId[]> = {
  michaela: ['temToEvaluate', 'lowCilia', 'reportMissing', 'unclear'],
  vojtech: ['readyForConclusion', 'recent', 'unclear', 'stale'],
  lucia: ['temToPrepare', 'temToEvaluate', 'normalTemSuspicion', 'unclear'],
}

// ---------- Options ----------

export const FLAG_FILTERS = [
  { key: 'laterality', label: 'Porucha laterality' },
  { key: 'rds', label: 'RDS novorodenca' },
  { key: 'heart', label: 'Srdcová vada' },
  { key: 'family', label: 'PCD v rodine' },
] as const

export const NNO_OPTIONS = [
  { value: 'low', label: `Nízke (< ${NNO_THRESHOLD} ppb)` },
  { value: 'normal', label: `V norme (≥ ${NNO_THRESHOLD} ppb)` },
] as const

export const PICADAR_OPTIONS = [
  { value: 'high', label: `≥ ${PICADAR_CUTOFF} bodov` },
  { value: 'low', label: `< ${PICADAR_CUTOFF} bodov` },
] as const

export const AGE_OPTIONS = [
  { value: 'child', label: 'Deti (< 18 r.)' },
  { value: 'adult', label: 'Dospelí (≥ 18 r.)' },
] as const

export const AGE_AT_DX_OPTIONS = [
  { value: 'infant', label: '0–5 rokov' },
  { value: 'child', label: '6–17 rokov' },
  { value: 'adult', label: '18+ rokov' },
] as const

export const SIBLING_OPTIONS = [
  { value: 'none', label: 'Bez súrodencov' },
  { value: 'some', label: '1 a viac súrodencov' },
] as const

/** Filters that live in the "Ďalšie filtre" panel (shown as chips under the bar when active). */
export const ADVANCED_KEYS: FilterKey[] = ['laterality', 'rds', 'heart', 'family', 'nno', 'picadar', 'age', 'ageAtDx', 'siblings']
/** Keys without their own control in the bar – shown as chips when set (F02 or advanced panel). */
export const CHIP_KEYS: FilterKey[] = [...ADVANCED_KEYS, 'genetics', 'stale']

const optionLabel = (options: readonly { value: string; label: string }[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value

export function matches(p: Patient, f: Filters): boolean {
  const a = p.anamnesis
  if (f.queue && !QUEUES[f.queue].test(p)) return false
  if (f.statuses.length && !f.statuses.includes(p.status)) return false
  if (f.defects.length && !(p.exams.tem.defect && f.defects.includes(p.exams.tem.defect))) return false
  if (f.laterality && (!a || a.situs === 'solitus')) return false
  if (f.rds && !a?.neonatalRds) return false
  if (f.heart && !a?.heartDefect) return false
  if (f.family && !a?.familyPcd) return false
  if (f.nno) {
    const v = p.exams.nno.value
    if (v == null) return false
    if (f.nno === 'low' ? v >= NNO_THRESHOLD : v < NNO_THRESHOLD) return false
  }
  if (f.picadar) {
    if (p.picadar == null) return false
    if ((f.picadar === 'high') !== p.picadar >= PICADAR_CUTOFF) return false
  }
  if (f.age && (f.age === 'child') !== ageOf(p) < 18) return false
  if (f.ageAtDx) {
    const d = p.ageAtDiagnosis
    if (d == null) return false
    const band = d <= 5 ? 'infant' : d < 18 ? 'child' : 'adult'
    if (band !== f.ageAtDx) return false
  }
  if (f.siblings && (!a || (f.siblings === 'none') !== (a.siblings === 0))) return false
  if (f.genetics === 'missing' && !['pending', 'notDone'].includes(p.exams.genetics.status)) return false
  if (f.stale && !isStale(p)) return false
  return true
}

/** Human-readable description of one active filter (used for chips and AI interpretation). */
export function describe(key: FilterKey, f: Filters): string | null {
  switch (key) {
    case 'queue':
      return f.queue ? QUEUES[f.queue].label : null
    case 'statuses':
      return f.statuses.length ? f.statuses.map((s) => PATIENT_STATUS[s].label).join(', ') : null
    case 'defects':
      return f.defects.length ? f.defects.map((d) => DEFECT_LABEL[d]).join(', ') : null
    case 'laterality':
    case 'rds':
    case 'heart':
    case 'family':
      return f[key] ? FLAG_FILTERS.find((x) => x.key === key)!.label : null
    case 'nno':
      return f.nno ? `nNO ${optionLabel(NNO_OPTIONS, f.nno).toLowerCase()}` : null
    case 'picadar':
      return f.picadar ? `PICADAR ${optionLabel(PICADAR_OPTIONS, f.picadar)}` : null
    case 'age':
      return f.age ? optionLabel(AGE_OPTIONS, f.age) : null
    case 'ageAtDx':
      return f.ageAtDx ? `Diagnóza vo veku ${optionLabel(AGE_AT_DX_OPTIONS, f.ageAtDx)}` : null
    case 'siblings':
      return f.siblings ? optionLabel(SIBLING_OPTIONS, f.siblings) : null
    case 'genetics':
      return f.genetics ? 'Genetika chýba / čaká sa' : null
    case 'stale':
      return f.stale ? `Bez zmeny > ${STALE_DAYS / 7} týždne` : null
  }
}

export const activeKeys = (f: Filters) =>
  (Object.keys(f) as FilterKey[]).filter((k) => describe(k, f) !== null)

export const isIdQuery = (q: string) => /^\s*(pcd[-\s]?)?\d{1,4}\s*$/i.test(q)
export const idDigits = (q: string) => q.replace(/\D/g, '')
