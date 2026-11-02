import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function Placeholder({ title }: { title: string }) {
  const { id } = useParams()
  return (
    <div className="flex flex-col gap-4">
      <div className="px-1 pt-2">
        {id && (
          <Link to="/patients" className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-ink-600 hover:text-ink-900">
            <ArrowLeft size={14} /> Pacienti
          </Link>
        )}
        <h1 className="text-[28px] font-semibold tracking-[-0.01em]">
          {title} {id && <span className="font-mono">{id}</span>}
        </h1>
        <p className="mt-1 text-ink-600">Táto obrazovka príde v ďalšom kroku.</p>
      </div>
      <div className="hatch h-64 rounded-card" />
    </div>
  )
}
