export type RoleId = 'vojtech' | 'michaela' | 'lucia'

export type ExamStatus = 'normal' | 'abnormal' | 'pending' | 'notDone'
export type PatientStatus = 'diagnostics' | 'unclear' | 'confirmed' | 'excluded'
export type Situs = 'solitus' | 'inversus' | 'ambiguus'
export type TemDefect = 'ODA' | 'IDA_ODA' | 'MTD' | 'CP' | 'normal'

export interface Anamnesis {
  situs: Situs
  neonatalRds: boolean
  nicu: boolean
  heartDefect: boolean
  familyPcd: boolean
  siblings: number
  wetCough: boolean
  rhinitis: boolean
  otitis: boolean
  fullTerm: boolean
}

export interface Exams {
  nno: { status: ExamStatus; value: number | null }
  hsvm: { status: ExamStatus }
  tem: { status: ExamStatus; defect: TemDefect | null; ciliaCount: number | null }
  if: { status: ExamStatus }
  genetics: { status: ExamStatus; gene: string | null }
}

export interface Patient {
  id: string
  sampleNo: number
  birthYear: number
  status: PatientStatus
  ageAtDiagnosis: number | null
  owner: RoleId
  sharedWith: RoleId[]
  addedAt: string
  lastActivity: string
  anamnesis: Anamnesis | null // null = not transcribed yet (the pediatrician records it in UNIS; copying it here is optional)
  picadar: number | null
  clinicalIndex: number | null
  exams: Exams
}
