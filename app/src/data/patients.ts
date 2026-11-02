import type { Anamnesis, Exams, Patient, PatientStatus, RoleId, Situs, TemDefect } from '../types'

// Fictional mock data, generated deterministically (same seed = same patients on every reload).

export const TODAY = new Date('2026-11-02T12:00:00')
export const NNO_THRESHOLD = 180 // ppb – per Dominika, to verify
export const MIN_CILIA = 100
export const STALE_DAYS = 21

export function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(42)
const chance = (p: number) => rand() < p
const between = (a: number, b: number) => Math.round(a + rand() * (b - a))
const pick = <T>(items: T[]): T => items[Math.floor(rand() * items.length)]

export function daysAgo(n: number) {
  const d = new Date(TODAY)
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const GENES: Record<TemDefect, string[]> = {
  ODA: ['DNAH5', 'DNAI1', 'DNAI2'],
  IDA_ODA: ['LRRC6', 'DNAAF1', 'ZMYND10'],
  MTD: ['CCDC39', 'CCDC40'],
  CP: ['RSPH4A', 'RSPH1'],
  normal: ['DNAH11', 'HYDIN', 'CCNO'],
}

const CONFIRMED_DEFECTS: TemDefect[] = ['ODA', 'ODA', 'ODA', 'IDA_ODA', 'IDA_ODA', 'MTD', 'CP', 'normal', 'normal']
const ROLE_IDS: RoleId[] = ['vojtech', 'vojtech', 'michaela', 'michaela', 'lucia']

// How "PCD-like" the anamnesis of each group tends to be.
const LIKENESS: Record<PatientStatus, number> = { confirmed: 1, unclear: 0.75, diagnostics: 0.6, excluded: 0.2 }

function makeExams(status: PatientStatus, age: number): Exams {
  switch (status) {
    case 'confirmed': {
      const defect = pick(CONFIRMED_DEFECTS)
      return {
        nno: chance(0.9) ? { status: 'abnormal', value: between(8, 95) } : { status: 'notDone', value: null },
        hsvm: { status: 'abnormal' },
        tem: { status: defect === 'normal' ? 'normal' : 'abnormal', defect, ciliaCount: between(110, 320) },
        if: { status: chance(0.5) ? 'abnormal' : 'notDone' },
        genetics: chance(0.65) ? { status: 'abnormal', gene: pick(GENES[defect]) } : { status: 'pending', gene: null },
      }
    }
    case 'unclear':
      return {
        nno: { status: 'abnormal', value: between(95, 175) },
        hsvm: { status: chance(0.6) ? 'abnormal' : 'pending' },
        tem: { status: 'normal', defect: 'normal', ciliaCount: between(100, 180) },
        if: { status: chance(0.5) ? 'pending' : 'notDone' },
        genetics: { status: chance(0.6) ? 'pending' : 'notDone', gene: null },
      }
    case 'excluded':
      return {
        nno: { status: 'normal', value: between(210, 620) },
        hsvm: { status: 'normal' },
        tem: { status: 'normal', defect: 'normal', ciliaCount: between(100, 200) },
        if: { status: 'notDone' },
        genetics: chance(0.3) ? { status: 'normal', gene: null } : { status: 'notDone', gene: null },
      }
    case 'diagnostics': {
      const nnoValue = between(20, 480)
      const temDone = chance(0.5)
      const defect = pick(CONFIRMED_DEFECTS)
      return {
        nno: age < 5
          ? { status: 'notDone', value: null }
          : chance(0.7)
            ? { status: nnoValue < NNO_THRESHOLD ? 'abnormal' : 'normal', value: nnoValue }
            : { status: 'pending', value: null },
        hsvm: { status: chance(0.5) ? 'abnormal' : 'pending' },
        tem: temDone
          ? { status: defect === 'normal' ? 'normal' : 'abnormal', defect, ciliaCount: between(100, 160) }
          : { status: 'pending', defect: null, ciliaCount: null },
        if: { status: 'notDone' },
        genetics: { status: chance(0.4) ? 'pending' : 'notDone', gene: null },
      }
    }
  }
}

// PICADAR (Behan et al.) – applies only to patients with a daily wet cough.
export const PICADAR_ITEMS: { label: string; points: number; get: (a: Anamnesis) => boolean }[] = [
  { label: 'Narodenie v termíne', points: 2, get: (a) => a.fullTerm },
  { label: 'Hrudné príznaky po narodení (RDS)', points: 2, get: (a) => a.neonatalRds },
  { label: 'Hospitalizácia na JIS novorodencov', points: 2, get: (a) => a.nicu },
  { label: 'Chronická rinitída', points: 1, get: (a) => a.rhinitis },
  { label: 'Chronické ušné / sluchové problémy', points: 1, get: (a) => a.otitis },
  { label: 'Situs inversus / heterotaxia', points: 4, get: (a) => a.situs !== 'solitus' },
  { label: 'Vrodená srdcová vada', points: 2, get: (a) => a.heartDefect },
]
export const PICADAR_MAX = 14
export const PICADAR_CUTOFF = 5

export const picadarScore = (a: Anamnesis) =>
  a.wetCough ? PICADAR_ITEMS.reduce((sum, i) => sum + (i.get(a) ? i.points : 0), 0) : null

// Clinical index used in the centre – simplified to 7 yes/no items for the prototype.
export const CLINICAL_INDEX_ITEMS: { label: string; get: (a: Anamnesis) => boolean }[] = [
  { label: 'RDS novorodenca', get: (a) => a.neonatalRds },
  { label: 'Chronický vlhký kašeľ', get: (a) => a.wetCough },
  { label: 'Chronická rinitída', get: (a) => a.rhinitis },
  { label: 'Ušné problémy', get: (a) => a.otitis },
  { label: 'Porucha laterality', get: (a) => a.situs !== 'solitus' },
  { label: 'Srdcová vada', get: (a) => a.heartDefect },
  { label: 'PCD v rodine', get: (a) => a.familyPcd },
]

export const clinicalIndexScore = (a: Anamnesis) => CLINICAL_INDEX_ITEMS.filter((i) => i.get(a)).length

function generate(id: string, status: PatientStatus): Patient {
  const birthYear = chance(0.7) ? between(2008, 2024) : between(1976, 2007)
  const age = TODAY.getFullYear() - birthYear
  const like = LIKENESS[status]

  const situs: Situs = chance(like * 0.45) ? 'inversus' : chance(like * 0.1) ? 'ambiguus' : 'solitus'
  const neonatalRds = chance(0.15 + like * 0.55)
  const anamnesis = {
    situs,
    neonatalRds,
    nicu: neonatalRds && chance(0.6),
    heartDefect: situs === 'ambiguus' ? chance(0.7) : chance(like * 0.1),
    familyPcd: chance(like * 0.2),
    siblings: between(0, 3),
    wetCough: chance(0.55 + like * 0.4),
    rhinitis: chance(0.4 + like * 0.5),
    otitis: chance(0.3 + like * 0.4),
    fullTerm: chance(0.85),
  }

  const picadar = picadarScore(anamnesis)
  const clinicalIndex = clinicalIndexScore(anamnesis)

  const owner = pick(ROLE_IDS)
  const added = status === 'diagnostics' ? between(3, 90) : status === 'unclear' ? between(30, 400) : between(60, 1400)
  const idle = status === 'diagnostics' ? between(0, 30) : status === 'unclear' ? between(3, 60) : between(20, Math.min(added, 600))

  return {
    id,
    sampleNo: chance(0.75) ? 1 : 2,
    birthYear,
    ...(chance(0.5) && {}), // was sex – dropped (irrelevant for PCD per Majka); call kept so the mock data stays the same
    status,
    ageAtDiagnosis: status === 'confirmed' ? Math.min(age, chance(0.75) ? between(0, 12) : between(13, 40)) : null,
    owner,
    sharedWith: (['vojtech', 'michaela', 'lucia'] as RoleId[]).filter((r) => r !== owner && chance(0.35)),
    addedAt: daysAgo(added),
    lastActivity: daysAgo(Math.min(idle, added)),
    anamnesis,
    picadar: status === 'diagnostics' && chance(0.3) ? null : picadar,
    clinicalIndex: status === 'diagnostics' && chance(0.3) ? null : clinicalIndex,
    exams: makeExams(status, age),
  }
}

// Key scenarios for testing with doctors – fixed IDs so they are easy to find.
const KEY_IDS = ['PCD-0087', 'PCD-0118', 'PCD-0142', 'PCD-0163', 'PCD-0171']

const STATUS_PATTERN = 'CEDUCEECDUCECEDUECCEUDCEDCUEECDUCE'
const STATUS_BY_LETTER: Record<string, PatientStatus> = { C: 'confirmed', E: 'excluded', U: 'unclear', D: 'diagnostics' }

function buildPatients(): Patient[] {
  const list: Patient[] = []
  let n = 31
  for (const letter of STATUS_PATTERN.slice(0, 31)) {
    n += between(2, 6)
    let id = `PCD-${String(n).padStart(4, '0')}`
    while (KEY_IDS.includes(id)) id = `PCD-${String(++n).padStart(4, '0')}`
    list.push(generate(id, STATUS_BY_LETTER[letter]))
  }

  // Main uncertain case: normal TEM, but low nNO + positive anamnesis.
  const p142 = generate('PCD-0142', 'unclear')
  Object.assign(p142, {
    birthYear: 2019, owner: 'vojtech', sharedWith: ['michaela'], lastActivity: daysAgo(4), addedAt: daysAgo(38)
  })
  Object.assign(p142.anamnesis, { fullTerm: true, situs: 'solitus', neonatalRds: true, nicu: true, familyPcd: true, wetCough: true, rhinitis: true, otitis: true, heartDefect: false, siblings: 2 })
  p142.exams = {
    nno: { status: 'abnormal', value: 96 },
    hsvm: { status: 'abnormal' },
    tem: { status: 'normal', defect: 'normal', ciliaCount: 142 },
    if: { status: 'pending' },
    genetics: { status: 'pending', gene: null },
  }

  // Confirmed PCD despite normal TEM (DNAH11) – genetics arrived yesterday; similar case for PCD-0142, triggers F08 for PCD-0087.
  const p118 = generate('PCD-0118', 'confirmed')
  Object.assign(p118, { birthYear: 2016, ageAtDiagnosis: 10, owner: 'vojtech', addedAt: daysAgo(720), lastActivity: daysAgo(1) })
  Object.assign(p118.anamnesis, { situs: 'solitus', neonatalRds: true, familyPcd: false, wetCough: true, rhinitis: true })
  p118.exams = {
    nno: { status: 'abnormal', value: 58 },
    hsvm: { status: 'abnormal' },
    tem: { status: 'normal', defect: 'normal', ciliaCount: 210 },
    if: { status: 'abnormal' },
    genetics: { status: 'abnormal', gene: 'DNAH11' },
  }

  // Excluded in 2023 because of normal TEM – should be re-evaluated (F08).
  const p087 = generate('PCD-0087', 'excluded')
  Object.assign(p087, { birthYear: 2014, owner: 'vojtech', sharedWith: [], addedAt: daysAgo(1180), lastActivity: daysAgo(1100) })
  Object.assign(p087.anamnesis, { situs: 'solitus', neonatalRds: true, wetCough: true, rhinitis: true })
  p087.exams = {
    nno: { status: 'abnormal', value: 162 },
    hsvm: { status: 'normal' },
    tem: { status: 'normal', defect: 'normal', ciliaCount: 118 },
    if: { status: 'notDone' },
    genetics: { status: 'notDone', gene: null },
  }

  // TEM evaluation in progress, fewer than 100 cilia (F07).
  const p163 = generate('PCD-0163', 'diagnostics')
  Object.assign(p163, { birthYear: 2021, owner: 'michaela', sharedWith: ['vojtech', 'lucia'], lastActivity: daysAgo(1), addedAt: daysAgo(12) })
  Object.assign(p163.anamnesis, { situs: 'inversus', neonatalRds: true })
  p163.exams = {
    nno: { status: 'abnormal', value: 44 },
    hsvm: { status: 'abnormal' },
    tem: { status: 'pending', defect: 'ODA', ciliaCount: 72 },
    if: { status: 'notDone' },
    genetics: { status: 'notDone', gene: null },
  }

  // Stuck case – no activity for more than 3 weeks.
  const p171 = generate('PCD-0171', 'diagnostics')
  Object.assign(p171, { owner: 'vojtech', lastActivity: daysAgo(26), addedAt: daysAgo(55) })
  p171.exams.genetics = { status: 'pending', gene: null }

  // Complete unclear case – all results in, waiting for the clinician's conclusion (queue "Pripravené na záver", F06).
  const p141 = list.find((p) => p.id === 'PCD-0141')
  if (p141) p141.exams.if = { status: 'abnormal' }

  list.push(p142, p118, p087, p163, p171)
  // Key cases changed their anamnesis – keep scores consistent with it.
  for (const p of [p142, p118, p087, p163, p171]) {
    p.picadar = picadarScore(p.anamnesis)
    p.clinicalIndex = clinicalIndexScore(p.anamnesis)
  }
  return list.sort((a, b) => a.id.localeCompare(b.id))
}

export const PATIENTS: Patient[] = buildPatients()

export const ageOf = (p: Patient) => TODAY.getFullYear() - p.birthYear

export const idleDays = (p: Patient) =>
  Math.round((TODAY.getTime() - new Date(p.lastActivity).getTime()) / 86_400_000)

export const isStale = (p: Patient) =>
  (p.status === 'diagnostics' || p.status === 'unclear') && idleDays(p) > STALE_DAYS
