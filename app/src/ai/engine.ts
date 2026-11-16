import { NNO_THRESHOLD, PATIENTS, ageOf } from '../data/patients'
import { DEFECT_LABEL, lowerFirst } from '../labels'
import type { Patient } from '../types'

// Wizard-of-Oz "AI": deterministic rules over mock data. No real model.

// ---------- Similar cases (F01 / F04) ----------

export interface SimilarCase {
  patient: Patient
  score: number // 0..1, used only for ordering – never shown as a number
  shared: string[] // attributes that match
  different: string[] // attributes that differ
}

const nnoBand = (p: Patient) => {
  const v = p.exams.nno.value
  return v == null ? null : v < NNO_THRESHOLD ? 'low' : 'normal'
}

const FLAGS: { label: string; get: (p: Patient) => boolean }[] = [
  { label: 'Porucha laterality', get: (p) => p.anamnesis != null && p.anamnesis.situs !== 'solitus' },
  { label: 'RDS novorodenca', get: (p) => !!p.anamnesis?.neonatalRds },
  { label: 'Srdcová vada', get: (p) => !!p.anamnesis?.heartDefect },
  { label: 'PCD v rodine', get: (p) => !!p.anamnesis?.familyPcd },
]

// Weights: TEM defect matters most, then nNO band. A shared positive finding counts more than a shared absence.
const W_DEFECT = 3
const W_NNO = 2
const W_FLAG_POS = 1.5
const W_FLAG_NEG = 0.5
const MAX = W_DEFECT + W_NNO + FLAGS.length * W_FLAG_POS
export const SIMILARITY_THRESHOLD = 0.6

export function compare(p: Patient, q: Patient): SimilarCase {
  let score = 0
  const shared: string[] = []
  const different: string[] = []

  const d1 = p.exams.tem.defect
  const d2 = q.exams.tem.defect
  if (d1 && d2) {
    if (d1 === d2) { score += W_DEFECT; shared.push(`TEM: ${lowerFirst(DEFECT_LABEL[d1])}`) }
    else different.push(`TEM: ${lowerFirst(DEFECT_LABEL[d2])}`)
  }

  const n1 = nnoBand(p)
  const n2 = nnoBand(q)
  if (n1 && n2) {
    const label = n2 === 'low' ? 'nízke nNO' : 'nNO v norme'
    if (n1 === n2) { score += W_NNO; shared.push(label) } else different.push(label)
  }

  // Unknown anamnesis on either side → the flags cannot be compared (not counted as a shared absence).
  if (p.anamnesis && q.anamnesis) for (const f of FLAGS) {
    const a = f.get(p)
    const b = f.get(q)
    if (a && b) { score += W_FLAG_POS; shared.push(f.label) }
    else if (!a && !b) score += W_FLAG_NEG
    else different.push(b ? f.label : `bez: ${lowerFirst(f.label)}`)
  }

  return { patient: q, score: score / MAX, shared, different }
}

export function findSimilar(p: Patient): SimilarCase[] {
  return PATIENTS.filter((q) => q.id !== p.id)
    .map((q) => compare(p, q))
    .filter((c) => c.score >= SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
}

export function outcomeSummary(similar: SimilarCase[]) {
  const closed = similar.filter((c) => c.patient.status === 'confirmed' || c.patient.status === 'excluded')
  return {
    total: similar.length,
    closed: closed.length,
    confirmed: closed.filter((c) => c.patient.status === 'confirmed').length,
    open: similar.length - closed.length,
  }
}

// ---------- Case comparison: the doctor sees and controls what "similar" means ----------

export interface SimilarityCriterion {
  id: string
  label: string
  matches: (q: Patient) => boolean
}

/** What can be compared for this patient – only values it actually has, in the order the defaults are tried. */
export function similarityCriteria(p: Patient): SimilarityCriterion[] {
  const e = p.exams
  const out: SimilarityCriterion[] = []
  if (e.tem.defect && (e.tem.status === 'normal' || e.tem.status === 'abnormal')) out.push({
    id: 'tem', label: `TEM: ${lowerFirst(DEFECT_LABEL[e.tem.defect])}`,
    matches: (q) => q.exams.tem.defect === e.tem.defect && q.exams.tem.status === e.tem.status,
  })
  const band = nnoBand(p)
  if (band) out.push({ id: 'nno', label: band === 'low' ? 'Nízke nNO' : 'nNO v norme', matches: (q) => nnoBand(q) === band })
  FLAGS.filter((f) => f.get(p)).forEach((f) => out.push({ id: f.label, label: f.label, matches: f.get }))

  const status = (k: 'hsvm' | 'if', name: string) => {
    const s = e[k].status
    if (s === 'normal' || s === 'abnormal') out.push({
      id: k, label: `${name} ${s === 'normal' ? 'v norme' : 'mimo normy'}`, matches: (q) => q.exams[k].status === s,
    })
  }
  status('hsvm', 'HSVM')
  status('if', 'IF')
  if (e.genetics.gene) out.push({
    id: 'genetics', label: `Variant v géne ${e.genetics.gene}`, matches: (q) => q.exams.genetics.gene === e.genetics.gene,
  })
  return out
}

/** Strict match: a patient is in the group only if every selected criterion holds, so the group is easy to explain. */
export function findCohort(p: Patient, criteria: SimilarityCriterion[]): SimilarCase[] {
  if (criteria.length === 0) return []
  const closed = (c: SimilarCase) => c.patient.status === 'confirmed' || c.patient.status === 'excluded'
  return PATIENTS.filter((q) => q.id !== p.id && criteria.every((c) => c.matches(q)))
    .map((q) => compare(p, q))
    .sort((a, b) => Number(closed(b)) - Number(closed(a)) || b.score - a.score)
}

const MIN_COHORT = 3
const MAX_COHORT = 6
const MAX_DEFAULT_CRITERIA = 3 // stay broad: a stricter default would hide exactly the excluded look-alikes

/** Pre-selection the doctor can change: narrows the group step by step, but never below MIN_COHORT patients. */
export function defaultCriteria(p: Patient, criteria: SimilarityCriterion[]): string[] {
  const picked: SimilarityCriterion[] = []
  for (const c of criteria) {
    const size = findCohort(p, [...picked, c]).length
    if (size < MIN_COHORT) continue
    picked.push(c)
    if (size <= MAX_COHORT || picked.length === MAX_DEFAULT_CRITERIA) break
  }
  return picked.map((c) => c.id)
}

/** Exams not finished when a patient was excluded – the exclusion may rest on incomplete results. */
export function missingAtExclusion(q: Patient): string[] {
  if (q.status !== 'excluded') return []
  return (Object.keys(EXAM_NAMES) as (keyof typeof EXAM_NAMES)[])
    .filter((k) => q.exams[k].status === 'pending' || q.exams[k].status === 'notDone')
    .map((k) => EXAM_NAMES[k])
}

export interface OpenLead {
  exam: string
  abnormal: number
  confirmed: number
}

/** Exams this patient still lacks, with how they came out in the confirmed patients of the group. */
export function openLeads(p: Patient, cohort: SimilarCase[]): OpenLead[] {
  const confirmed = cohort.filter((c) => c.patient.status === 'confirmed').map((c) => c.patient)
  return (['hsvm', 'if', 'genetics'] as const)
    .filter((k) => p.exams[k].status === 'pending' || p.exams[k].status === 'notDone')
    .map((k) => ({
      exam: EXAM_NAMES[k],
      abnormal: confirmed.filter((q) => q.exams[k].status === 'abnormal').length,
      confirmed: confirmed.length,
    }))
}

// ---------- Conflicts (F05) ----------

export interface Conflict {
  title: string
  pro: string[] // findings pointing towards PCD
  contra: string[] // findings pointing away from PCD
  suggestion: string
}

function pcdIndicators(p: Patient): string[] {
  const out: string[] = []
  const e = p.exams
  if (e.nno.value != null && e.nno.value < NNO_THRESHOLD) out.push(`nNO ${e.nno.value} ppb (pod hranicou ${NNO_THRESHOLD})`)
  if (e.hsvm.status === 'abnormal') out.push('HSVM: abnormálny pohyb riasiniek')
  if (e.if.status === 'abnormal') out.push('IF: chýbajúci proteín')
  if (e.genetics.status === 'abnormal') out.push(`Genetika: variant v géne ${e.genetics.gene}`)
  if (p.picadar != null && p.picadar >= 5) out.push(`PICADAR ${p.picadar}/14`)
  for (const f of FLAGS) if (f.get(p)) out.push(f.label)
  return out
}

export function findConflicts(p: Patient): Conflict[] {
  const conflicts: Conflict[] = []
  const pro = pcdIndicators(p)
  const temNormal = p.exams.tem.defect === 'normal' && p.exams.tem.status === 'normal'
  const nnoNormal = p.exams.nno.value != null && p.exams.nno.value >= NNO_THRESHOLD

  if (temNormal && pro.length >= 2 && (p.status === 'unclear' || p.status === 'diagnostics')) {
    conflicts.push({
      title: 'Normálny TEM, ale ostatné výsledky naznačujú PCD',
      pro,
      contra: ['TEM: normálna ultraštruktúra'],
      suggestion: 'Približne 30 % pacientov s PCD má normálny TEM. Môže stáť za to doplniť IF, genetiku alebo tomografiu.',
    })
  }

  if (p.exams.tem.status === 'abnormal' && nnoNormal) {
    conflicts.push({
      title: 'Defekt na TEM, ale nNO v norme',
      pro: [`TEM: ${lowerFirst(DEFECT_LABEL[p.exams.tem.defect!])}`],
      contra: [`nNO ${p.exams.nno.value} ppb`],
      suggestion: 'Môže stáť za overenie merania nNO alebo zopakovanie odberu.',
    })
  }

  if (p.status === 'excluded' && p.exams.nno.value != null && p.exams.nno.value < NNO_THRESHOLD) {
    conflicts.push({
      title: 'Pacient je vylúčený, ale nNO je pod hranicou',
      pro,
      contra: ['Stav: vylúčená PCD', ...(temNormal ? ['TEM: normálna ultraštruktúra'] : [])],
      suggestion: 'Vylúčenie bolo pravdepodobne založené na normálnom TEM. Môže stáť za to prípad prehodnotiť.',
    })
  }

  return conflicts
}

// ---------- Second opinion (F06) ----------
// Runs only AFTER the doctor submits a conclusion. Speaks up only when the evidence points elsewhere.

export type Verdict = 'confirmed' | 'excluded' | 'unclear'

export interface Finding {
  text: string
  towards: 'pcd' | 'notPcd' | 'open' // which way the finding points
}

export interface SecondOpinion {
  agrees: boolean
  headline: string
  findings: Finding[] // feature attribution – what drove the check
  path: string[] // decision-tree path for "Prečo?"
  similar: SimilarCase[]
}

const EXAM_NAMES = { nno: 'nNO', hsvm: 'HSVM', tem: 'TEM', if: 'IF', genetics: 'genetika' } as const

export function secondOpinion(p: Patient, verdict: Verdict): SecondOpinion {
  const e = p.exams
  // Only a defect on TEM counts as hallmark. Genetics alone is not a diagnostic criterion in the centre
  // (Dominika; >50 genes) and IF is supportive – both are weighed as supportive findings.
  // NOTE: rules are a prototype assumption – to be reviewed with Dominika.
  const hallmark = e.tem.status === 'abnormal' && e.tem.defect != null && e.tem.defect !== 'normal'
  const nnoLow = e.nno.value != null && e.nno.value < NNO_THRESHOLD
  const nnoNormal = e.nno.value != null && !nnoLow
  const supportiveFlags = [nnoLow, e.hsvm.status === 'abnormal', (p.picadar ?? 0) >= 5, e.genetics.status === 'abnormal', e.if.status === 'abnormal']
  const supportive = supportiveFlags.filter(Boolean).length
  const pending = (Object.keys(EXAM_NAMES) as (keyof typeof EXAM_NAMES)[]).filter((k) => e[k].status === 'pending')

  const findings: Finding[] = []
  if (hallmark) findings.push({ text: `TEM: ${lowerFirst(DEFECT_LABEL[e.tem.defect!])} (hallmark)`, towards: 'pcd' })
  if (e.tem.defect === 'normal' && e.tem.status === 'normal') findings.push({ text: 'TEM: normálna ultraštruktúra (u ~30 % PCD)', towards: 'notPcd' })
  if (e.genetics.status === 'abnormal') findings.push({ text: `Genetika: variant v géne ${e.genetics.gene} (sama nestačí)`, towards: 'pcd' })
  if (e.if.status === 'abnormal') findings.push({ text: 'IF: chýbajúci proteín', towards: 'pcd' })
  if (e.if.status === 'normal') findings.push({ text: 'IF: proteíny prítomné', towards: 'notPcd' })
  if (nnoLow) findings.push({ text: `nNO ${e.nno.value} ppb (pod hranicou ${NNO_THRESHOLD})`, towards: 'pcd' })
  if (nnoNormal) findings.push({ text: `nNO ${e.nno.value} ppb (v norme)`, towards: 'notPcd' })
  if (e.hsvm.status === 'abnormal') findings.push({ text: 'HSVM: abnormálny pohyb riasiniek', towards: 'pcd' })
  if (e.hsvm.status === 'normal') findings.push({ text: 'HSVM: normálny pohyb riasiniek', towards: 'notPcd' })
  if (p.picadar != null && p.picadar >= 5) findings.push({ text: `PICADAR ${p.picadar}/14`, towards: 'pcd' })
  if (pending.length) findings.push({ text: `Čaká sa: ${list(pending.map((k) => EXAM_NAMES[k]))}`, towards: 'open' })

  // Decision tree the "AI" walks through – also shown under "Prečo?".
  const SUPPORTIVE = 'nízke nNO, abnormálne HSVM, PICADAR ≥ 5, variant v géne, chýbajúci proteín na IF'
  const path: string[] = []
  let leaning: Verdict
  if (hallmark) {
    path.push('Je na TEM hallmark defekt? → áno')
    leaning = 'confirmed'
  } else {
    path.push('Je na TEM hallmark defekt? → nie')
    if (supportive >= 2) {
      path.push(`Podporné nálezy (${SUPPORTIVE}): ${supportive} z 5 → PCD nemožno vylúčiť, ale bez hallmark nálezu ani potvrdiť`)
      leaning = 'unclear'
    } else if (nnoNormal && e.hsvm.status !== 'abnormal') {
      path.push('nNO v norme a HSVM bez abnormality → PCD je málo pravdepodobná')
      leaning = 'excluded'
    } else {
      path.push(`Podporné nálezy: ${supportive} z 5 → nedostatok podkladov`)
      leaning = 'unclear'
    }
  }
  if (verdict !== 'unclear' && pending.length) path.push(`Uzatvárajúci záver, ale ${pending.length === 1 ? 'jedno vyšetrenie ešte čaká' : `${pending.length} vyšetrenia ešte čakajú`}`)

  const similar = findSimilar(p)
  const o = outcomeSummary(similar)
  const simText = o.closed > 0 ? ` ${o.confirmed} z ${o.closed} podobných pacientov so záverom malo potvrdenú PCD.` : ''

  let headline = ''
  if (verdict === 'excluded' && leaning !== 'excluded') {
    headline = hallmark
      ? 'Na TEM je hallmark defekt, ktorý záveru „vylúčená PCD“ odporuje.'
      : `Pri tejto kombinácii výsledkov PCD nemožno s istotou vylúčiť.${simText}`
  } else if (verdict === 'confirmed' && !hallmark) {
    headline = supportive >= 2
      ? `Potvrdenie sa opiera o ${supportive} ${supportive < 5 ? 'podporné nálezy' : 'podporných nálezov'}, hallmark defekt na TEM chýba. Môže stáť za to uviesť v zdôvodnení, čo rozhodlo.`
      : 'Potvrdenie PCD nemá oporu ani v hallmark náleze na TEM, ani v podporných nálezoch.'
  } else if (verdict === 'unclear' && hallmark) {
    headline = 'Na TEM je hallmark defekt. Ak prípad nechávate otvorený, môže stáť za to uviesť v zdôvodnení prečo.'
  } else if (verdict !== 'unclear' && pending.length) {
    headline = `Záver uzatvára prípad, hoci ešte čaká ${list(pending.map((k) => EXAM_NAMES[k]))}.`
  }

  return { agrees: headline === '', headline, findings, path, similar }
}

// ---------- Case summary ----------

const list = (items: string[]) =>
  items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} a ${items[items.length - 1]}`

export function caseSummary(p: Patient): string[] {
  const e = p.exams
  const names: [string, string, string][] = [
    ['nNO', e.nno.status, e.nno.value != null ? `nNO (${e.nno.value} ppb)` : 'nNO'],
    ['HSVM', e.hsvm.status, 'HSVM'],
    ['TEM', e.tem.status, e.tem.defect ? `TEM (${lowerFirst(DEFECT_LABEL[e.tem.defect])})` : 'TEM'],
    ['IF', e.if.status, 'IF'],
    ['Genetika', e.genetics.status, e.genetics.gene ? `genetika (${e.genetics.gene})` : 'genetika'],
  ]
  const by = (s: string) => names.filter((n) => n[1] === s).map((n) => n[2])

  const flags = FLAGS.filter((f) => f.get(p)).map((f) => lowerFirst(f.label))
  const sentences = [
    `Pacient vo veku ${ageOf(p)} r.${!p.anamnesis ? ', anamnéza nie je zapísaná' : flags.length ? `, v anamnéze ${list(flags)}` : ', bez výrazných nálezov v anamnéze'}${p.picadar != null ? `; PICADAR ${p.picadar}/14` : ''}.`,
  ]
  if (by('abnormal').length) sentences.push(`Mimo normy: ${list(by('abnormal'))}.`)
  if (by('normal').length) sentences.push(`V norme: ${list(by('normal'))}.`)
  if (by('pending').length) sentences.push(`Čakajúce výsledky: ${list(by('pending'))}.`)
  return sentences
}
