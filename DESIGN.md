# PCD Aid – Design system (rapid prototyp)

Zdroj: 3 referencie v `design/`. Čo z ktorej berieme:

| Referencia | Berieme |
|---|---|
| **Donezo** (zelený dashboard) | sivé plátno + biele zaoblené karty, plávajúci sidebar ako panel, pill tlačidlá (plné + obrysové), stat karty s veľkým číslom a ↗ v krúžku, jedna „hero“ karta plnou farbou, **šrafovanie = chýbajúce / čakajúce dáta**, uppercase labely sekcií v sidebare, ⌘K v searchi |
| **Skymetrics** (metrics + AI chat) | striedmosť a hustota, delta badge pri čísle, mono číslice, **layout AI asistenta** (konverzácia + bočný panel s výsledkom), akcie pod AI odpoveďou (👍 👎 kopírovať · Prečo?), stav „Premýšľam…“, input so ✨ chipom |
| **Findings** (modré karty) | **elektrická modrá ako farba AI**, AI insight karta plnou modrou s jemnými kružnicami a obrysovým tagom, status pill s **bodkou**, obrysové tagy kategórií, segmentový progress bar, prerušovaná referenčná čiara + čierny tooltip, okrúhle ikonové tlačidlá (hľadať, filter), hover riadku |

## 1 · Základné pravidlá (to najdôležitejšie)

1. **Modrá = AI. Nič iné nie je modré.** Hlavné akcie appky sú navy (tmavá ink farba), takže AI je vždy na prvý pohľad odlíšená. (Tým sa rieši aj konflikt s Majkiným modrým akcentom: jej navy `dark-1` je u nás primárna farba.)
2. **Plátno je sivé, obsah je v bielych kartách.** Karty nemajú tieň ani rámik, oddeľuje ich kontrast s plátnom.
3. **Farba nesie význam, nie dekoráciu.** Zelená / červená sú pre výsledky vyšetrení, „čaká sa“ je sivé (výsledok ešte nie je), jantárová znamená pozor (nejasný prípad, zaseknutý prípad, málo riasiniek). Všetko ostatné je neutrálne.
4. **Všetko interaktívne je pill** (tlačidlá, tagy, filtre, taby, inputy). Karty majú veľký radius, vnútorné prvky stredný.
5. **Čísla sú hrdinovia.** Kľúčová hodnota (nNO, PICADAR, počet riasiniek) je veľká, regular váha, tabulárne číslice a jednotka je menšia a sivá.
6. **Chýbajúce dáta = šrafovanie**, nikdy prázdne miesto ani „0“.

## 2 · Farby

```
canvas        #F2F3F7   pozadie aplikácie
surface       #FFFFFF   karty, sidebar, topbar
surface-muted #F7F8FA   hover riadku, input, vnorené plochy
border        #E7E9EF   iba vnútri kariet (oddeľovače, obrysové pill)

ink-900  #0F1B33   text, primárne tlačidlo, aktívna položka (Majkin navy)
ink-600  #5B6475   sekundárny text
ink-400  #9AA1AE   placeholder, disabled, osi grafov
ink-200  #D5D9E2   šrafovanie, neaktívne segmenty

ai-600   #3A3AF4   AI: plná karta, ikona ✨, akcent AI textu
ai-700   #2B2BD1   AI hover
ai-100   #DDE1FF   AI obrys / chip
ai-50    #EEF0FF   AI pozadie (panel, bublina)
```

**Stavy vyšetrení** (pill: tónované pozadie + bodka + text):

| Stav | Bodka/text | Pozadie |
|---|---|---|
| V norme | `#15803D` | `#E8F7EE` |
| Mimo normy | `#D93036` | `#FDECEC` |
| Čaká sa | `#B45309` | `#FEF4E2` |
| Nevykonané | `#9AA1AE` | šrafovanie |

**Stav pacienta** (obrysový pill s bodkou, bez pozadia): *V diagnostike* (sivá bodka) · *Nejasný* (jantárová) · *Potvrdená PCD* (ink-900) · *Vylúčená* (ink-400, prečiarknutý nie, len sivý text).

## 3 · Typografia

- **Inter** (Google Fonts) pre všetko, **JetBrains Mono** pre ID pacientov, čísla odberov a namerané hodnoty v tabuľkách.
- Čísla vždy `font-variant-numeric: tabular-nums`.

| Token | Veľkosť / váha | Použitie |
|---|---|---|
| `display` | 40 / 400, tracking −0.02em | hlavné číslo v stat karte |
| `h1` | 28 / 600, tracking −0.01em | nadpis stránky |
| `h2` | 18 / 600 | nadpis karty |
| `h3` | 15 / 600 | podsekcia, meno v zozname |
| `body` | 14 / 400 | bežný text |
| `small` | 12 / 400–500 | meta, popisky, pill text |
| `label` | 11 / 600 UPPERCASE, tracking 0.06em, ink-400 | sekcie v sidebare, hlavičky tabuliek |

Nadpis stránky má vždy pod sebou jednovetový podnadpis v ink-600 (ako Donezo).

## 4 · Tvar, priestor, hĺbka

- **Radius:** karta `20px` · vnorený blok / tooltip `12px` · pill `9999px`.
- **Spacing:** násobky 4. Padding karty `24px` (kompaktná karta `20px`). Medzera medzi kartami `16px`. Okraj plátna `16px`.
- **Výšky:** tlačidlo/input `40px` (malé `32px`) · ikonové tlačidlo `40×40` kruh · riadok tabuľky `56px`.
- **Tiene:** žiadne. Výnimka sú dropdown, popover, modal a WoZ panel: `0 8px 24px rgba(15,27,51,.08)`.
- **Ikony:** Lucide, 18px, stroke 1.75, farba podľa textu.

## 5 · Layout aplikácie

```
┌ canvas (16px okraj) ─────────────────────────────────────────┐
│ ┌ sidebar 248px ┐ ┌ topbar (karta, 64px) ─────────────────┐  │
│ │ logo          │ │ 🔍 Hľadať pacienta…  ⌘K   [rola ▾] 🔔 👤│  │
│ │ MENU          │ └───────────────────────────────────────┘  │
│ │ ▌Pacienti     │ ┌ obsah ───────────────────────────────┐   │
│ │  Notifikácie 3│ │ H1 + podnadpis          [akcie]      │   │
│ │  Zdieľané     │ │ grid kariet (12 col, gap 16)         │   │
│ │ VŠEOBECNÉ     │ │                                      │   │
│ │  Nastavenia   │ │                       ┌ AI panel ┐   │   │
│ │  Pomoc        │ │                       │ 380px    │   │   │
│ └───────────────┘ └───────────────────────┴──────────┴───┘   │
└──────────────────────────────────────────────────────────────┘
```

- Sidebar aj topbar sú biele karty na plátne (plávajúce, ako Donezo).
- Aktívna položka v sidebare: text ink-900 + 3px navy pruh vľavo + ikona plná. Neaktívne sú ink-600. Počty notifikácií sú malý navy badge.
- **AI panel** sa otvára vpravo ako stĺpec 380px (nie modal), obsah sa zúži. Pozadie má `ai-50`.
- Desktop-first (1440 cieľ, min. 1280). Mobil neriešime.

## 6 · Komponenty

**Tlačidlá** (pill, 40px, 14/500):
- `primary`: ink-900 bg, biely text. Jedno na obrazovku/kartu.
- `secondary`: biele, 1px border, ink-900 text.
- `ghost`: bez pozadia, hover surface-muted.
- `ai`: ai-600 bg, biely text, ikona ✨. **Iba pre spustenie AI akcie.**
- `icon`: 40px kruh, biely s borderom (na plátne) alebo surface-muted (v karte).

**Stat karta:** label (h3, ink-600), vpravo ↗ ikonové tlačidlo, `display` číslo + jednotka, dole stavový pill alebo kontext („hranica 180 ppb“). Nanajvýš jedna karta na riadok môže byť „hero“ (plná ink-900).

**Status pill:** výška 24px, 12/500, bodka 6px + text. Pozri tabuľku stavov.

**Tag / filter chip:** obrysový pill 32px, border, 13px. Aktívny filter má ink-900 bg, biely text a ✕.

**Taby:** segmented control: surface-muted kontajner (pill) a aktívny tab je biela pill. Pre taby vyšetrení v profile: rovnaký štýl, s malou stavovou bodkou pri názve.

**Tabuľka:** v karte, bez vertikálnych čiar. Hlavička je `label` štýl, riadky sú oddelené 1px border a pri hoveri majú surface-muted s radiusom 12. ID pacienta je mono. Na konci riadku je `⋯`.

**Input / search:** surface-muted bg, bez borderu, pill, ikona vľavo. Skratka vpravo ako `kbd` (biely box, 11px).

**Progress (segmentový):** 6px vysoké pill segmenty s 4px medzerou, popisky pod nimi. Použitie: vyhodnotené riasinky voči cieľu 100, kompletnosť vyšetrení.

**Grafy:** zaoblené stĺpce, neaktívne v ink-200, zvýraznený v ink-900 (alebo ai-600, ak ide o AI výstup), chýbajúce sú šrafované. Referenčná hranica (napr. nNO) je prerušovaná čiara s čiernym tooltipom/labelom.

**Šrafovanie:** `repeating-linear-gradient(135deg, #D5D9E2 0 2px, transparent 2px 7px)`.

## 7 · AI vizuálny jazyk

Všetko, čo vygenerovala AI, nesie aspoň jedno z: **✨ ikonu v ai-600**, **ai-50 pozadie**, **ai-100 obrys**. Nič iné tieto farby nepoužíva.

- **AI tlačidlo v hlavičke:** `aiSoft` – ai-50 bg, ai-100 obrys, ✨ + text v ai-700 (rovnaký vzhľad ako AI inline karta). Plnú ai-600 nepoužívať na veľké plochy – modrá je akcent, nemá kričať.
- **AI inline karta:** ai-50 bg, ai-100 border, ✨ + nadpis v ai-700, text ink-900. Pre upozornenia (rozpor, < 100 riasiniek).
- **AI odpoveď** (panel/chat): pod každou je riadok akcií `Prečo?` · 👍 · 👎 · kopírovať. **„Prečo?“ je povinné** a rozbalí vysvetlenie (atribúty / podobní pacienti / rozhodovací strom).
- **Neistota:** vždy „X z Y“ + pri malej vzorke sivá poznámka „malá vzorka (n = 5)“. Žiadne percentá s desatinnou čiarkou.
- **Stav načítania:** ✨ + „Premýšľam…“ so shimmer efektom v ai-100.
- **AI nikdy nepíše diagnózu.** Formulácie: „podobné prípady“, „môže stáť za overenie“, „nezhoduje sa s…“.

## 8 · Text a obsah

- UI je v slovenčine, vety krátke, tlačidlá sú slovesá („Pridať pacienta“, „Otvoriť v CiliaScan“).
- Pacient je vždy pod ID (`PCD-0142`) + odber + rok narodenia. Nikdy meno.
- Dátumy: `12. 3. 2025`, relatívne pri notifikáciách („pred 2 h“).
- Jednotky sú vždy pri hodnote a menšie: `142 ppb`, `86 / 100 riasiniek`.

## 9 · Tailwind v4 tokeny

```css
@import "tailwindcss";

@theme {
  --font-sans: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --color-canvas: #F2F3F7;
  --color-surface: #FFFFFF;
  --color-surface-muted: #F7F8FA;
  --color-border: #E7E9EF;

  --color-ink-900: #0F1B33;
  --color-ink-600: #5B6475;
  --color-ink-400: #9AA1AE;
  --color-ink-200: #D5D9E2;

  --color-ai-50: #EEF0FF;
  --color-ai-100: #DDE1FF;
  --color-ai-600: #3A3AF4;
  --color-ai-700: #2B2BD1;

  --color-ok: #15803D;      --color-ok-bg: #E8F7EE;
  --color-bad: #D93036;     --color-bad-bg: #FDECEC;
  --color-wait: #B45309;    --color-wait-bg: #FEF4E2;

  --radius-card: 20px;
  --radius-inner: 12px;
}

.hatch { background: repeating-linear-gradient(135deg, var(--color-ink-200) 0 2px, transparent 2px 7px); }
.num   { font-variant-numeric: tabular-nums; }
```

## Checklist pred každou obrazovkou
- [ ] Je modrá použitá **len** na AI?
- [ ] Najviac jedno primárne tlačidlo a jedna hero karta?
- [ ] Má každý AI výstup „Prečo?“ a počet namiesto percent?
- [ ] Sú chýbajúce dáta šrafované, nie prázdne?
- [ ] Je pacient len pod ID?
