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
  evaluated: boolean
  cilia: number // cilia annotated on this image
  blurry: boolean
  seed: number
}

export interface TemDetails {
  counts: { category: CiliaCategory; n: number }[]
  evaluated: number
  images: TemImage[]
  syncedAt: string
}

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

export function temDetails(p: Patient): TemDetails {
  const rand = mulberry32(hash(p.id))
  const t = p.exams.tem
  const total = t.ciliaCount ?? 0

  // Split the evaluated cilia into categories around the dominant finding.
  const shares: Partial<Record<CiliaCategory, number>> =
    !t.defect || t.defect === 'normal'
      ? { normal: 0.9 + rand() * 0.05, ODA: 0.02, MTD: 0.01 }
      : { [t.defect]: 0.62 + rand() * 0.12, normal: 0.14 + rand() * 0.06, CP: t.defect === 'MTD' ? 0.06 : 0.01 }
  const order: CiliaCategory[] = ['normal', 'ODA', 'IDA_ODA', 'MTD', 'CP']
  const counts = order.map((category) => ({ category, n: Math.round(total * (shares[category] ?? 0)) }))
  const assigned = counts.reduce((s, c) => s + c.n, 0)
  counts.push({ category: 'nonEval', n: Math.max(total - assigned, 0) })

  // ~6 cilia per evaluated image; work in progress has a batch of not-yet-evaluated images.
  const evaluatedImages = Math.ceil(total / 6)
  const pendingImages = t.status === 'pending' ? (total ? 14 : 24) : 3
  const images: TemImage[] = Array.from({ length: evaluatedImages + pendingImages }, (_, i) => {
    const evaluated = i < evaluatedImages
    return {
      id: `IMG_${String(i + 1).padStart(3, '0')}`,
      evaluated,
      cilia: evaluated ? (i === evaluatedImages - 1 ? total - 6 * (evaluatedImages - 1) : 6) : 0,
      blurry: !evaluated && rand() < 0.2,
      seed: hash(p.id) + i * 101,
    }
  })

  return { counts: counts.filter((c) => c.n > 0), evaluated: total, images, syncedAt: 'dnes 9:12' }
}
