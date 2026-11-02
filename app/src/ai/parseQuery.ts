import type { Filters } from '../filters'
import type { TemDefect } from '../types'

// Wizard-of-Oz "AI" for F02: keyword rules translate a Slovak sentence into filters.
// Every rule remembers which phrase triggered it, so the UI can show how the sentence was understood.

export interface ParseMatch {
  phrase: string
  patch: Partial<Filters>
}

export interface ParseResult {
  query: string
  matches: ParseMatch[]
  filters: Partial<Filters>
  unknown: string[]
}

const FROM = 'áäčďéíĺľňóôŕšťúýž'
const TO = 'aacdeillnoorstuyz'

/** Lowercase + strip Slovak diacritics, keeping string length (so match indexes map back to the original). */
const fold = (s: string) =>
  [...s.toLowerCase()].map((ch) => (FROM.includes(ch) ? TO[FROM.indexOf(ch)] : ch)).join('')

const defect = (d: TemDefect): Partial<Filters> => ({ defects: [d] })

const RULES: { re: RegExp; patch: Partial<Filters> }[] = [
  { re: /(nizk\w*|znizen\w*)\s+(\w+\s+)?n?no\b|\bn?no\s+(\w+\s+)?(nizk\w*|znizen\w*|pod\s+\d+)/, patch: { nno: 'low' } },
  { re: /(normaln\w*|vysok\w*)\s+(\w+\s+)?n?no\b|\bn?no\s+(\w+\s+)?(v norme|normaln\w*)/, patch: { nno: 'normal' } },
  { re: /(normaln\w*)\s+(\w+\s+)?(tem\w*|ultrastruktur\w*)|\btem\w*\s+(\w+\s+)?(v norme|normaln\w*)/, patch: defect('normal') },
  { re: /\boda\b|vonkajs\w*\s+dynein\w*/, patch: defect('ODA') },
  { re: /\bida\b|vnutorn\w*\s+dynein\w*/, patch: defect('IDA_ODA') },
  { re: /mikrotubul\w*|dezorganiz\w*/, patch: defect('MTD') },
  { re: /centraln\w*\s+par\w*|transpoz\w*/, patch: defect('CP') },
  { re: /\bmlad\w*|\bdeti\w*|\bdetsk\w*|\bdieta\w*|\bmalolet\w*/, patch: { age: 'child' } },
  { re: /\bdospel\w*/, patch: { age: 'adult' } },
  { re: /situs\s*\w*|lateralit\w*|inversus|heterotax\w*|zrkadlov\w*/, patch: { laterality: true } },
  { re: /\brds(\s+novoroden\w*)?|tiesn\w*|novoroden\w*/, patch: { rds: true } },
  { re: /srdc\w*(\s+vad\w*)?|kardi\w*/, patch: { heart: true } },
  { re: /(pcd\s+)?v\s+rodin\w*|rodinn\w*|dedicn\w*/, patch: { family: true } },
  { re: /bez\s+surodenc\w*|ziadn\w*\s+surodenc\w*|jedinac\w*/, patch: { siblings: 'none' } },
  { re: /(so|s|maju\w*)\s+surodenc\w*/, patch: { siblings: 'some' } },
  { re: /potvrden\w*/, patch: { statuses: ['confirmed'] } },
  { re: /vylucen\w*|zamietnut\w*/, patch: { statuses: ['excluded'] } },
  { re: /nejasn\w*|neist\w*|sporn\w*/, patch: { statuses: ['unclear'] } },
  { re: /v\s+diagnostik\w*|rozpracovan\w*/, patch: { statuses: ['diagnostics'] } },
  { re: /(bez|chyba\w*|nema\w*|caka\w*\s+na)\s+(\w+\s+)?genetik\w*|genetik\w*\s+(chyba|caka|nie je)/, patch: { genetics: 'missing' } },
  { re: /zaseknut\w*|stoj\w*(\s+dlho)?(\s+bez\s+zmen\w*)?|dlho\s+bez\s+zmen\w*|neaktivn\w*/, patch: { stale: true } },
]

const STOP = ['pacient', 'ukaz', 'najdi', 'vyhladaj', 'ktor', 'maju', 'mali', 'hodnot', 'alebo', 'vsetk', 'prosim',
  'pripad', 'chcem', 'zobraz', 'tych', 'tieto', 'aj', 'ale', 'ich', 'mi', 'a', 's', 'so', 'z', 'zo', 'v', 'vo', 'na', 'do', 'pcd']

export function parseQuery(query: string): ParseResult {
  const text = fold(query)
  const covered = new Array(text.length).fill(false)
  const matches: ParseMatch[] = []
  const filters: Partial<Filters> = {}

  for (const rule of RULES) {
    const m = rule.re.exec(text)
    if (!m) continue
    // Skip if this span overlaps a phrase already explained by an earlier (more specific) rule.
    if (covered.slice(m.index, m.index + m[0].length).some(Boolean)) continue
    for (let i = m.index; i < m.index + m[0].length; i++) covered[i] = true

    matches.push({ phrase: query.slice(m.index, m.index + m[0].length).trim(), patch: rule.patch })
    for (const [key, value] of Object.entries(rule.patch)) {
      const prev = (filters as Record<string, unknown>)[key]
      ;(filters as Record<string, unknown>)[key] =
        Array.isArray(value) && Array.isArray(prev) ? [...new Set([...prev, ...value])] : value
    }
  }

  const unknown: string[] = []
  for (const w of text.matchAll(/[a-z0-9]+/g)) {
    const start = w.index ?? 0
    const isStop = STOP.some((s) => (s.length <= 3 ? w[0] === s : w[0].startsWith(s)))
    if (covered[start] || w[0].length < 3 || isStop) continue
    unknown.push(query.slice(start, start + w[0].length))
  }

  return { query, matches, filters, unknown }
}

export const EXAMPLE_QUERIES = [
  'deti s nízkym nNO a normálnym TEM',
  'potvrdené PCD so situs inversus',
  'nejasné prípady bez genetiky',
  'RDS novorodenca a PCD v rodine',
]
