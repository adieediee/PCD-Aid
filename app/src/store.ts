import { useSyncExternalStore } from 'react'
import { PATIENTS, TODAY, clinicalIndexScore, picadarScore } from './data/patients'
import type { TemImage } from './data/tem'
import type { Anamnesis, Patient, PatientStatus, RoleId } from './types'

// In-memory edits made during a test session (lost on reload). Mutates mock data and notifies subscribers.

let version = 0
const listeners = new Set<() => void>()

export function emitChange() {
  version++
  listeners.forEach((l) => l())
}

/** Re-render when anything in the store changes. Returns a counter usable as a memo dependency. */
export function useStoreVersion() {
  return useSyncExternalStore(
    (l) => { listeners.add(l); return () => { listeners.delete(l) } },
    () => version,
  )
}

export const todayIso = () => TODAY.toISOString().slice(0, 10)

// ---------- Flow 1: add patient ----------

export function nextPatientId() {
  const max = Math.max(...PATIENTS.map((p) => Number(p.id.slice(4))))
  return `PCD-${String(max + 1).padStart(4, '0')}`
}

export function addPatient(input: { id: string; sampleNo: number; birthYear: number; status: PatientStatus; owner: RoleId }) {
  const p: Patient = {
    ...input,
    ageAtDiagnosis: null,
    sharedWith: [],
    addedAt: todayIso(),
    lastActivity: todayIso(),
    anamnesis: null, // transcribed later from UNIS (or never)
    picadar: null,
    clinicalIndex: null,
    exams: {
      nno: { status: 'notDone', value: null },
      hsvm: { status: 'notDone' },
      tem: { status: 'notDone', defect: null, ciliaCount: null },
      if: { status: 'notDone' },
      genetics: { status: 'notDone', gene: null },
    },
  }
  PATIENTS.push(p)
  PATIENTS.sort((a, b) => a.id.localeCompare(b.id))
  emitChange()
}

// ---------- Anamnesis (transcribed from UNIS / questionnaire) ----------

export function saveAnamnesis(p: Patient, a: Anamnesis) {
  p.anamnesis = a
  p.picadar = picadarScore(a)
  p.clinicalIndex = clinicalIndexScore(a)
  p.lastActivity = todayIso()
  emitChange()
}

// ---------- Flow 2: record nNO ----------

export function recordNno(p: Patient, value: number, threshold: number) {
  p.exams.nno = { status: value < threshold ? 'abnormal' : 'normal', value }
  p.lastActivity = todayIso()
  emitChange()
}

// ---------- Flow 3: upload TEM images ----------

const uploads = new Map<string, TemImage[]>()
const freshTem = new Set<string>() // TEM started during the session → no generated mock images

export const uploadedImages = (id: string) => uploads.get(id) ?? []
export const hasMockImages = (p: Patient) => p.exams.tem.status !== 'notDone' && !freshTem.has(p.id)

export function addUploadedImages(p: Patient, names: string[], startIndex: number) {
  const imgs: TemImage[] = names.map((_, i) => ({
    id: `IMG_${String(startIndex + i + 1).padStart(3, '0')}`,
    uploadedAt: todayIso(),
    evaluated: false,
    cilia: 0,
    blurry: (startIndex + i + 1) % 6 === 0, // mock AI result, so the pre-selection can be tested on uploads
    seed: Date.now() + i * 101,
  }))
  uploads.set(p.id, [...uploadedImages(p.id), ...imgs])
  if (p.exams.tem.status === 'notDone') {
    freshTem.add(p.id)
    p.exams.tem = { ...p.exams.tem, status: 'pending' }
  }
  p.lastActivity = todayIso()
  emitChange()
}

// ---------- Images sent to CiliaScan (simulated hand-off, one project per patient + sample) ----------

const opened = new Map<string, string[]>()

export const openedImages = (id: string) => opened.get(id) ?? []

export function markOpened(p: Patient, ids: string[]) {
  opened.set(p.id, [...openedImages(p.id), ...ids])
  p.lastActivity = todayIso()
  emitChange()
}

// ---------- Recently opened patients (top bar search) ----------

let recent: string[] = []

export const recentPatients = () => recent

export function visitPatient(id: string) {
  if (recent[0] === id) return
  recent = [id, ...recent.filter((x) => x !== id)].slice(0, 5)
  emitChange()
}

// ---------- TEM report sent to the clinician (shared by the TEM tab and the work queues) ----------

const sentReports = new Map<string, boolean>()

/** Mock default: a report exists once the case left "V diagnostike"; session sends/edits override it. */
export const reportSent = (p: Patient) => sentReports.get(p.id) ?? (p.status !== 'diagnostics' && p.exams.tem.ciliaCount != null)

export function setReportSent(id: string, sent: boolean) {
  sentReports.set(id, sent)
  emitChange()
}
