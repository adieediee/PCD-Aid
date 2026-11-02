import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { Button, PatientStatusPill } from './ui'
import { findSimilar, outcomeSummary } from '../ai/engine'
import type { Patient } from '../types'

export function AiFeedback({ why, onWhy }: { why: boolean; onWhy: () => void }) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const btn = (kind: 'up' | 'down') =>
    `flex size-8 items-center justify-center rounded-full hover:bg-surface cursor-pointer ${feedback === kind ? 'text-ai-700' : 'text-ink-600'}`
  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="ghost" onClick={onWhy} className="text-ai-700 hover:text-ai-700">
        {why ? 'Skryť vysvetlenie' : 'Prečo?'}
      </Button>
      <button aria-label="Užitočné" className={btn('up')} onClick={() => setFeedback('up')}><ThumbsUp size={15} /></button>
      <button aria-label="Neužitočné" className={btn('down')} onClick={() => setFeedback('down')}><ThumbsDown size={15} /></button>
      {feedback && <span className="ml-1 text-xs text-ink-600">Ďakujem za spätnú väzbu</span>}
    </div>
  )
}

/** Right-hand AI column: similar cases and how they turned out (F01 + F04). Full version = screen 3. */
export default function AiPanel({ patient, onClose }: { patient: Patient; onClose: () => void }) {
  const [why, setWhy] = useState(false)
  const similar = findSimilar(patient)
  const o = outcomeSummary(similar)

  return (
    <aside className="sticky top-4 flex max-h-[calc(100vh-2rem)] w-[380px] shrink-0 flex-col overflow-hidden rounded-card border border-ai-100 bg-ai-50">
      <div className="flex items-center justify-between px-5 pt-5">
        <div className="flex items-center gap-2 text-[15px] font-semibold text-ai-700">
          <Sparkles size={16} /> Podobné prípady
        </div>
        <button aria-label="Zavrieť" onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-ink-600 hover:bg-surface cursor-pointer">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 pb-5">
        {o.total === 0 ? (
          <p className="mt-4 text-sm text-ink-600">V databáze sa nenašiel dostatočne podobný pacient.</p>
        ) : (
          <>
            <div className="mt-4 rounded-inner bg-surface p-4">
              {o.closed > 0 ? (
                <p className="text-[15px] leading-snug">
                  <span className="num text-[28px] leading-none font-normal tracking-[-0.02em] text-ai-700">{o.confirmed} z {o.closed}</span>
                  <br />podobných pacientov so záverom malo potvrdenú PCD.
                </p>
              ) : (
                <p className="text-[15px]">Žiadny z podobných pacientov ešte nemá záver.</p>
              )}
              {o.open > 0 && <p className="mt-2 text-xs text-ink-600">+ {o.open} podobných ešte bez záveru</p>}
              {o.closed < 10 && <p className="mt-1 text-xs text-ink-600">Malá vzorka (n = {o.closed}) – ber to ako orientačný údaj.</p>}
            </div>

            {why && (
              <div className="mt-3 rounded-inner bg-surface p-4 text-[13px] leading-relaxed text-ink-600">
                Podobnosť počítam zo 6 atribútov: <b className="font-semibold text-ink-900">typ defektu na TEM</b> (najväčšia váha),
                {' '}<b className="font-semibold text-ink-900">pásmo nNO</b> (pod / nad 180 ppb), porucha laterality, RDS novorodenca,
                srdcová vada a PCD v rodine. Spoločný pozitívny nález váži viac ako spoločná absencia. Pri každom pacientovi
                vidíš, v čom sa zhoduje a v čom líši.
              </div>
            )}

            <div className="mt-3"><AiFeedback why={why} onWhy={() => setWhy(!why)} /></div>

            <p className="mt-4 mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-400">Pacienti ({o.total})</p>
            <div className="flex flex-col gap-2">
              {similar.map((c) => (
                <Link key={c.patient.id} to={`/patients/${c.patient.id}`} className="block rounded-inner bg-surface p-3.5 transition-shadow hover:shadow-pop">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[13px] font-semibold">{c.patient.id}</span>
                    <PatientStatusPill status={c.patient.status} />
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {c.shared.map((s) => (
                      <span key={s} className="inline-flex h-5 items-center rounded-full border border-ai-100 bg-ai-50 px-2 text-[11px] font-medium text-ai-700">{s}</span>
                    ))}
                  </div>
                  {c.different.length > 0 && (
                    <p className="mt-2 text-[11px] text-ink-600">Líši sa: {c.different.join(', ')}</p>
                  )}
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </aside>
  )
}
