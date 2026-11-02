import { MIN_CILIA } from '../data/patients'
import { CATEGORY_LABEL, type TemDetails } from '../data/tem'
import { lowerFirst } from '../labels'
import type { Patient } from '../types'

// Wizard-of-Oz report drafting (F09) and reliability note (F07).

const pct = (n: number, total: number) => Math.round((n / total) * 100)

export const LOW_CILIA_NOTE = (n: number) =>
  `Pozn.: Vyhodnotených menej ako ${MIN_CILIA} riasiniek (n = ${n}), záver je preto orientačný.`

/** Which numbers the draft was built from – shown under "Prečo?". */
export function draftSources(d: TemDetails): string[] {
  const top = [...d.counts].filter((c) => c.category !== 'nonEval').sort((a, b) => b.n - a.n)[0]
  return [
    `${d.evaluated} vyhodnotených riasiniek na ${d.images.filter((i) => i.evaluated).length} snímkach (CiliaScan, ${d.syncedAt})`,
    top ? `Prevažuje: ${lowerFirst(CATEGORY_LABEL[top.category])} – ${top.n} z ${d.evaluated} (${pct(top.n, d.evaluated)} %)` : 'Bez prevažujúcej kategórie',
    `Šablóna správy oddelenia (verzia 2025)`,
    ...(d.evaluated < MIN_CILIA ? [`Menej ako ${MIN_CILIA} riasiniek → doplnená poznámka o spoľahlivosti`] : []),
    `Iné vyšetrenia (nNO, genetika) do textu správy zámerne nevstupujú`,
  ]
}

export function draftReport(p: Patient, d: TemDetails): string {
  const total = d.evaluated
  const lines = d.counts.map((c) => `– ${CATEGORY_LABEL[c.category]}: ${c.n} (${pct(c.n, total)} %)`)
  const top = [...d.counts].filter((c) => c.category !== 'nonEval').sort((a, b) => b.n - a.n)[0]

  const conclusion =
    !top || top.category === 'normal'
      ? 'Ultraštruktúra riasiniek je v norme. Normálny nález na TEM samostatne nevylučuje PCD – odporúča sa korelácia s nNO, HSVM, IF a genetickým vyšetrením.'
      : `Prevažujúci nález: ${CATEGORY_LABEL[top.category]} (${pct(top.n, total)} % hodnotených riasiniek).`

  return [
    `Elektrónovo-mikroskopické vyšetrenie respiračného epitelu, pacient ${p.id}, odber ${p.sampleNo}.`,
    `Vyhodnotených ${total} priečnych rezov riasiniek na ${d.images.filter((i) => i.evaluated).length} snímkach.`,
    '',
    ...lines,
    '',
    `Záver: ${conclusion}`,
    ...(total < MIN_CILIA ? ['', LOW_CILIA_NOTE(total)] : []),
  ].join('\n')
}
