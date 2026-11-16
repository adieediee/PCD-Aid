import type { ExamStatus, PatientStatus, RoleId, TemDefect } from './types'

export const ROLES: Record<RoleId, { name: string; title: string; initials: string }> = {
  vojtech: { name: 'Vojtech', title: 'Pediater', initials: 'VO' },
  michaela: { name: 'Michaela', title: 'Histopatologička', initials: 'MI' },
  lucia: { name: 'Lucia', title: 'PhD študentka', initials: 'LU' },
}

export const PATIENT_STATUS: Record<PatientStatus, { label: string; dot: string }> = {
  diagnostics: { label: 'V diagnostike', dot: 'bg-ink-400' },
  unclear: { label: 'Nejasný', dot: 'bg-wait' },
  confirmed: { label: 'Potvrdená PCD', dot: 'bg-ink-900' },
  excluded: { label: 'Vylúčená', dot: 'bg-ink-200' },
}

export const EXAM_STATUS: Record<ExamStatus, { label: string; pill: string; dot: string }> = {
  normal: { label: 'V norme', pill: 'bg-ok-bg text-ok', dot: 'bg-ok' },
  abnormal: { label: 'Mimo normy', pill: 'bg-bad-bg text-bad', dot: 'bg-bad' },
  pending: { label: 'Čaká sa', pill: 'bg-ink-200/40 text-ink-600', dot: 'bg-ink-400' },
  notDone: { label: 'Nevykonané', pill: 'hatch text-ink-600', dot: 'bg-ink-400' },
}

export const DEFECT_LABEL: Record<TemDefect, string> = {
  ODA: 'ODA defekt',
  IDA_ODA: 'IDA + ODA defekt',
  MTD: 'Mikrotubulárna dezorganizácia',
  CP: 'Centrálny pár / transpozícia',
  normal: 'Normálna ultraštruktúra',
}

export const DEFECT_SHORT: Record<TemDefect, string> = {
  ODA: 'ODA',
  IDA_ODA: 'IDA+ODA',
  MTD: 'MTD',
  CP: 'CP',
  normal: 'norm.',
}

/** Lowercase the first letter unless the word is an acronym (RDS, PCD, ODA…). */
export function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d}. ${m}. ${y}`
}

export const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLowerCase() + s.slice(1) : s)
