import placeholderCilia from '../assets/placeholder-cilia.jpg'
import { mulberry32 } from '../data/patients'
import type { TemImage } from '../data/tem'

/** TEM thumbnail: one placeholder photo, cropped differently per image so the gallery does not look like duplicates. */
export default function TemThumb({ img }: { img: TemImage }) {
  const rand = mulberry32(img.seed)
  const origin = `${Math.round(rand() * 100)}% ${Math.round(rand() * 100)}%`
  return (
    <div className="h-full w-full overflow-hidden">
      <img src={placeholderCilia} alt="" draggable={false} className="block h-full w-full object-cover"
        style={{ transform: `scale(${1.6 + rand() * 0.8})`, transformOrigin: origin, filter: img.blurry ? 'blur(1px)' : undefined }} />
    </div>
  )
}
