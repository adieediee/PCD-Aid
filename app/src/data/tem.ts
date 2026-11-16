import { mulberry32 } from './patients'
import type { Patient } from '../types'

// Mock CiliaScan output for the TEM tab, derived deterministically from the patient.

export type CiliaCategory = 'normal' | 'ODA' | 'IDA_ODA' | 'MTD' | 'CP' | 'nonEval'

export const CATEGORY_LABEL: Record<CiliaCategory, string> = {
  normal: 'Normálna ultraštruktúra',
  ODA: 'ODA defekt',
  IDA_ODA: 'IDA + ODA defekt',
  MTD: 'Mikrotubulárna dezorganizácia',
  CP: 'Centrálny pár / transpozícia',
  nonEval: 'Nehodnotiteľné',
}

export interface TemImage {
  id: string
  uploadedAt: string
  evaluated: boolean
  cilia: number // cilia annotated on this image
  blurry: boolean
  seed: number
}


export interface TemDetails {
  counts: { category: CiliaCategory; n: number }[]
  evaluated: number
  // CiliaScan annotates each cilium on two axes: microtubular class + dynein arm mark.
  // These summary numbers therefore overlap and do not add up to `evaluated`.
  summary: { normal: number; defective: number; dynein: number; mtd: number; ida: number; oda: number }
  images: TemImage[]
  syncedAt: string
}

const CILIA_PER_IMAGE = 4

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

export function temDetails(p: Patient): TemDetails {
  const rand = mulberry32(hash(p.id))
  const t = p.exams.tem
  const total = t.ciliaCount ?? 0

  // Split the evaluated cilia into categories around the dominant finding.
  const shares: Partial<Record<CiliaCategory, number>> =
    !t.defect || t.defect === 'normal'
      ? { normal: 0.9 + rand() * 0.05, ODA: 0.02, MTD: 0.01 }
      : { CP: t.defect === 'MTD' ? 0.06 : 0.01, [t.defect]: 0.62 + rand() * 0.12, normal: 0.14 + rand() * 0.06 } // dominant defect last, so it wins for CP
  const order: CiliaCategory[] = ['normal', 'ODA', 'IDA_ODA', 'MTD', 'CP']
  const counts = order.map((category) => ({ category, n: Math.round(total * (shares[category] ?? 0)) }))
  const assigned = counts.reduce((s, c) => s + c.n, 0)
  counts.push({ category: 'nonEval', n: Math.max(total - assigned, 0) })

  // Dominika: 100 cilia take about 20-30 images. Work in progress has a batch of not-yet-evaluated images.
  const evaluatedImages = Math.ceil(total / CILIA_PER_IMAGE)
  const pendingImages = t.status === 'pending' ? (total ? 14 : 24) : 3
  const images: TemImage[] = Array.from({ length: evaluatedImages + pendingImages }, (_, i) => {
    const evaluated = i < evaluatedImages
    return {
      id: `IMG_${String(i + 1).padStart(3, '0')}`,
      uploadedAt: evaluated ? p.addedAt : p.lastActivity, // two batches: first session, then the latest one
      evaluated,
      cilia: evaluated ? (i === evaluatedImages - 1 ? total - CILIA_PER_IMAGE * (evaluatedImages - 1) : CILIA_PER_IMAGE) : 0,
      blurry: !evaluated && rand() < 0.2,
      seed: hash(p.id) + i * 101,
    }
  })

  const countOf = (category: CiliaCategory) => counts.find((c) => c.category === category)?.n ?? 0
  const normal = countOf('normal')
  const nonEval = countOf('nonEval')
  const oda = countOf('ODA') + countOf('IDA_ODA')
  const summary = {
    normal,
    defective: total - normal - nonEval,
    // Arms are only visible at higher resolution, so only part of the cilia get this mark.
    dynein: Math.min(total - nonEval, Math.max(oda, Math.round(total * (0.55 + rand() * 0.25)))),
    mtd: countOf('MTD'),
    ida: countOf('IDA_ODA'),
    oda,
  }

  return { counts: counts.filter((c) => c.n > 0), evaluated: total, summary, images, syncedAt: 'dnes 9:12' }
}
