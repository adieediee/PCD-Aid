import type { ReactNode } from 'react'
import { ageOf } from '../data/patients'
import type { Patient } from '../types'

/** One labelled value of the patient banner: same label, same place on every screen. */
export function Fact({ label, title, children }: { label: string; title?: string; children: ReactNode }) {
  return (
    <div title={title} className="num flex items-baseline gap-1.5 text-[13px] whitespace-nowrap">
      <span className="text-ink-600">{label}</span>
      <span className="font-medium">{children}</span>
    </div>
  )
}

/** Identifiers shown wherever a patient is open. */
export function PatientFacts({ p }: { p: Patient }) {
  return (
    <>
      <Fact label="Odber">{p.sampleNo}</Fact>
      <Fact label="Vek">{ageOf(p)} r. <span className="font-normal text-ink-600">(nar. {p.birthYear})</span></Fact>
    </>
  )
}
