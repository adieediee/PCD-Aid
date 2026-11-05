# PCD Aid – rapid prototyp (kontext pre Claude Code)

## Čo staviame
Klikateľný **rapid prototyp** webovej aplikácie **PCD Aid** pre diplomovku (FIIT STU, vedúci Ing. Martin Dubovský). Účel: ukázať a otestovať obrazovky + AI funkcie s lekármi. **Nie je to produkčná appka.** Žiadny backend, žiadne reálne dáta pacientov, žiadny reálny ML model.

- Všetky dáta sú **fiktívne mock dáta** (JSON).
- AI je simulovaná metódou **Wizard of Oz** (predpripravené odpovede / jednoduché pravidlá nad mock dátami).
- Jazyk UI: **slovenčina**. Kód, komentáre, názvy premenných: angličtina.
- Priorita: rýchlosť iterácie a čistý, profesionálny vzhľad > robustnosť.

Návrh stacku (ak nie je dané inak): Vite + React + TypeScript + Tailwind, mock dáta v `src/data/*.json`, routing cez React Router. Žiadna DB, stav v pamäti.

## Doména v skratke
**PCD (primárna ciliárna dyskinéza)** – zriedkavé genetické ochorenie, riasinky (cilia) v dýchacích cestách sa nehýbu správne → opakované infekcie. Prevalencia ~1 : 7 500. **Neexistuje jeden test**, ktorý PCD potvrdí → diagnostika je viacstupňová a výsledky sú roztrúsené.

Vyšetrenia (taby v profile pacienta):
| Skratka | Čo to je | Kde sa robí |
|---|---|---|
| **Anamnéza** | klinické príznaky, dotazník | klinik / pediater |
| **PICADAR** | skórovací dotazník → pravdepodobnosť PCD (medzinárodný) | klinik |
| **Klinický index** | podobné skóre, používa sa v centre | klinik |
| **nNO** | nazálny oxid dusnatý; nízka hodnota = podozrenie (Dominika uvádza ~180 ppb ako hranicu – overiť) | ambulancia |
| **HSVM / HSVA** | high-speed videomikroskopia pohybu riasiniek | ambulancia |
| **TEM** | elektrónová mikroskopia – ultraštruktúra riasiniek, vyhodnocuje sa v **CiliaScan** | histológia (lab) |
| **IF** | imunofluorescencia – prítomnosť konkrétnych proteínov | lab |
| **Genetika** | >50 známych génov, sama nestačí na diagnózu | genetika (iné pracovisko) |
| (Tomografia) | 3D rekonštrukcia, drahá, len vybraní pacienti – **nie** je štandardný tab | lab |

TEM fakty pre realistické mock dáta:
- Z jedného fotenia 40–50 veľkých snímok; na záver treba vyhodnotiť **min. 100 riasiniek** (pri niektorých defektoch až 300).
- Typy defektov: ODA (outer dynein arm), IDA+ODA, mikrotubulárna dezorganizácia, central pair / transpozícia, **normálna ultraštruktúra**.
- **~30 % pacientov má normálny TEM, hoci iné vyšetrenia naznačujú PCD** – kľúčový „neistý“ prípad pre AI.

Objem: 1–3 odbery týždenne, 5–10 nových PCD pacientov ročne → databáza je malá (desiatky až stovky pacientov).

## Používatelia, role, prístupy
Persony z Majkinej DP:
- **Vojtech – pediater (klinik):** odoberá anamnézu, stanovuje **finálnu diagnózu**. Iba ošetrujúci lekár robí záver.
- **Michaela – histopatologička:** vyhodnocuje TEM v CiliaScane, píše správu.
- **Lucia – PhD študentka:** pripravuje TEM, IF, hľadá podobné prípady, výskum.

Dnes: lab **nevidí genetiku**, klinici **nevidia výsledky labu**, dáta pacientov sú v nemocničnom systéme UNIS (len fyzicky v nemocnici), snímky na fakultnom disku (stiahnutie pacienta ~1 h), komunikácia cez WhatsApp/e-mail. Pacienti v appke sú **pod identifikátormi, nie menami** (ID + číslo odberu + rok narodenia/vek).

## Čo už existuje (Majka – Mária Fedosenya, DP 2025)
- Výskum, workflow, card sorting → informačná architektúra.
- 7 user flows: pridanie pacienta, zápis nNO, upload TEM, anotácia, zdieľanie prípadu, review zdieľaného prípadu, záver.
- Lo-fi 2: **sidebar**, stránka **notifikácií**, **zoznam pacientov s filtrami** (taby *Moji / Zdieľaní*), **TEM tab** s poľom na správu a floating barom **„Otvoriť v CiliaScan“**, nNO sekcia.
- Hi-fi: logo, design systém, hotový len **zoznam pacientov**. Pri každom vyšetrení stav: *v norme / mimo normy / čaká sa*.
- AI asistent: iba textový koncept (podobné prípady, EUCA vysvetlenia, Wizard of Oz). **Žiadne UI.**
- V IA chýba anamnéza / PICADAR / klinický index → dopĺňam ja.

## Čo prototypujem (rapid screens)
1. **Zoznam + vyhľadávanie/filtrovanie pacientov** – podľa ID, typu defektu a anamnézy. Top filtre od Dominiky: **poruchy laterality (situs), RDS novorodenca, srdcové vady, PCD v rodine**. Ďalej vek pri diagnóze, počet súrodencov.
2. **Profil pacienta** – prehľad všetkých vyšetrení (stav + kľúčová hodnota), anamnéza, PICADAR/klinický index, taby vyšetrení.
3. **AI panel „Podobné prípady“** – podobní pacienti + ako dopadli + prečo sú podobní.
4. **TEM tab** – štatistiky z CiliaScanu, pole na správu, jasný vstup do CiliaScanu.
5. **Notifikácie** – napr. „prišla genetika“, „nové snímky“, „prípad stojí 3 týždne“.

## AI funkcie (z mojej rešerše, hodnotené v seminárnom dotazníku)
Ktoré idú do prototypu, rozhodnem podľa výsledkov dotazníka – **[DOPLNIŤ top funkcie]**.

**A · Hľadanie v minulých prípadoch**
- F01 Nájdi podobných pacientov – jedným klikom pacienti s podobnými výsledkami. *(Majka)*
- F02 Vyhľadávanie vetou – lekár napíše „mladí pacienti s nízkym nNO“, AI to preloží na filtre a **ukáže, ako vetu pochopila** (viditeľné chipy filtrov). *(čiastočne Majka)*
- F03 Štatistiky na otázku (chat) – odpoveď číslom + grafom.

**B · Pomoc pri rozhodovaní v neistých prípadoch** (jadro mojej práce)
- F04 Ako dopadli podobné prípady – napr. „8 z 12 podobných malo PCD“. *(Majka)*
- F05 Upozornenie na rozpor – napr. normálny TEM, ale nízke nNO + pozitívna anamnéza.
- F06 Druhý názor od AI – lekár napíše záver **sám**, AI ho skontroluje až potom a ozve sa len pri inom názore.
- F07 Spoľahlivosť záveru – upozornenie pri < 100 vyhodnotených riasinkách, návrh uviesť to v správe.
- F08 Prehodnotenie vylúčených pacientov – keď pribudne potvrdený prípad, AI upozorní na podobných predtým vylúčených.

**C · Menej rutinnej práce**
- F09 Návrh záverečnej správy – predvyplnená šablóna z výsledkov, lekár upraví.
- F10 Dopĺňanie textu správy – návrh pokračovania vety, prijatie jedným klávesom.
- ďalšie z dotazníka (F11–F16): pripomienka zaseknutého prípadu, súhrn prípadu pri otvorení, predvýber snímok, kontrola anonymizácie pred zdieľaním a i. **[DOPLNIŤ presný zoznam]**

## Princípy pre AI UI (záväzné)
- **AI nerozhoduje za lekára**, len dáva podklady. Žiadne „Diagnóza: PCD“.
- **Každý AI výstup má „Prečo?“** – vysvetlenie cez EUCA metódy, ktoré vyšli najlepšie: *feature attribute* (ktoré výsledky rozhodli), *similar example* (konkrétni podobní pacienti), *decision tree*.
- **Neistota je viditeľná** – počty („8 z 12“), nie falošne presné percentá; pri malej vzorke to povedať.
- Cieľ = **kalibrovaná dôvera** (ani over-, ani undertrust). Pri F06 neukazovať AI návrh pred záverom lekára.
- **Vizuálne odlíšenie AI: modrá** (konzistentne naprieč appkou, tak ako v náčrtoch), zvyšok UI neutrálny.
- Rešpektovať role: AI nesmie klinikovi ukázať dáta, ku ktorým by nemal prístup (a naopak) – pre prototyp stačí prepínač roly v hlavičke.

## Wizard of Oz
- AI odpovede sú deterministické z mock dát (podobnosť = zhoda na pár atribútoch: typ defektu, nNO pásmo, situs, RDS, srdcová vada, PCD v rodine).
- Pridaj skrytý **WoZ panel** (napr. klávesová skratka) na manuálne prepnutie AI odpovede / scenára počas testu s lekárom.
- Mock: ~30–40 pacientov, mix potvrdených PCD, vylúčených a nejasných; aspoň niekoľko „normálny TEM, ale PCD“ a jeden vylúčený pacient, ktorý by sa mal prehodnotiť.

## Dizajn
Záväzný design system je v [DESIGN.md](DESIGN.md) (tokeny, komponenty, AI vizuálny jazyk). Pred každou obrazovkou prejdi checklist na jeho konci.

## Spôsob práce
- Inkrementálne: jedna obrazovka → ukážem → upravím. Žiadne veľké refaktory bez opýtania.
- Stručné vysvetlenia, žiadne zbytočné boilerplate.
- Žiadne reálne mená, rodné čísla ani dátumy narodenia v dátach.

## Stav prototypu (aktualizované 2. 11. 2026)
Appka je v `app/` (Vite + React 19 + TS + Tailwind v4 + React Router + lucide-react). Spustenie: `cd app` → `npm run dev` → http://localhost:5173.

Štruktúra:
- `src/data/patients.ts` – 36 fiktívnych pacientov (seeded generátor) + PICADAR / klinický index s rozpisom bodov. `src/data/tem.ts` – mock výstup CiliaScanu (kategórie riasiniek, snímky).
- `src/ai/` – Wizard of Oz: `parseQuery.ts` (F02 veta → filtre), `engine.ts` (podobnosť F01/F04, rozpory F05, súhrn prípadu), `report.ts` (F09 návrh správy, F07 poznámka).
- `src/components/` – `ui.tsx` (tlačidlá, pill, chipy, Segmented, FilterMenu, Popover), `Layout.tsx` (sidebar, topbar, prepínač roly), `AiPanel.tsx` (podobné prípady + `AiFeedback` = Prečo?/👍/👎), `TemTab.tsx`.
- `src/pages/` – `PatientList.tsx`, `PatientProfile.tsx`, `Conclusion.tsx`, `Notifications.tsx`, `Placeholder.tsx`. `src/store.ts` (zmeny v pamäti), `src/conclusions.ts`, `src/notifications.ts`. `src/components/Forms.tsx` – formuláre flow 1–3.

Hotové screeny:
1. ✅ Zoznam pacientov – stat karty (klik = filter), jeden spoločný zoznam bez tabov, filtre anamnézy + dropdowny, F02 vyhľadávanie vetou, stránkovanie (15 na stranu).
2. ✅ Profil pacienta – hlavička, 5 kariet vyšetrení, ✨ súhrn + F05 rozpor, taby vyšetrení, PICADAR/klinický index, tlačidlo „Podobné prípady“ (`aiSoft`) otvára AI panel vpravo (`?ai=similar`). Modrá hero karta „X z Y podobných“ je zrušená (5. 11., AI nemá kričať).
3. ⏸ AI panel „Podobné prípady“ – základná verzia hotová; rozšírenia (porovnanie vedľa seba, rozhodovací strom) až po spätnej väzbe.
4. ✅ TEM tab – štatistiky, F07 (< 100 riasiniek), správa + F09 AI návrh (prijať/zahodiť/Prečo?), odoslanie klinikovi, snímky s výberom + floating bar „Otvoriť v CiliaScan“. Správu edituje len lab (Michaela/Lucia), Vojtech iba číta.

5. ✅ Záver + F06 – `pages/Conclusion.tsx` (`/patients/:id/conclusion`): vľavo podklady bez AI, vpravo výber záveru + zdôvodnenie + ďalší postup. AI (`secondOpinion` v `engine.ts`, rozhodovací strom nad hallmark/podpornými nálezmi) beží až po „Uložiť záver“; pri zhode uloží potichu, pri inom názore ukáže kartu Druhý názor (nálezy za/proti/otvorené, Prečo? = postup + podobní) s voľbou Upraviť / Ponechať a uložiť (+ poznámka). Závery v pamäti (`conclusions.ts`), menia stav pacienta. Píše len Vojtech.

6. ✅ Formuláre podľa Majkiných flowov – `components/Forms.tsx`: flow 1 Pridať pacienta (modal zo zoznamu; ID predvyplnené ďalšie, číslo odberu, rok narodenia, pohlavie, stav; validácia pri odoslaní), flow 2 zápis nNO (inline v tabe nNO, len Vojtech), flow 3 upload TEM (modal z TEM tabu, len lab; výber/drag&drop + „Ukážkové snímky“, opakované pridávanie, simulovaný priebeh). Zmeny v pamäti cez `store.ts` (`emitChange` / `useStoreVersion`).
7. ✅ Notifikácie – `pages/Notifications.tsx` + `notifications.ts` (Majkin lo-fi 2: Nové / Staršie, „Zobraziť“, nastavenia typov vpravo). Seed: genetika PCD-0118 → záver → F08 AI karta „PCD-0087 môže stáť za prehodnotenie“ (Prečo? = spoločné atribúty + čo pri vylúčení chýbalo), nové snímky PCD-0163, správa PCD-0142, zaseknuté prípady. Akcie v appke (nNO, upload, odoslanie správy, potvrdený záver → F08) vytvárajú notifikácie pre ostatné roly. Badge v sidebare je živý. Profil berie `?tab=`.

- Filtrovanie v zozname (podľa analýzy podkladov: 6/7 scenárov = hľadanie podľa ID, Majkin najnovší návrh = ID + Stav + „Show more filters“, pohlavie irelevantné): karty **Moja práca** podľa roly (`QUEUES` / `ROLE_QUEUES` v `filters.ts`, klik = fronta naprieč všetkými pacientmi); v lište ID/F02, Stav, Typ defektu (s počtami); „Ďalšie filtre“ (`AdvancedFilters.tsx`) = 4 atribúty anamnézy + nNO, PICADAR, vek, vek pri dg., súrodenci. Zrušené: pohlavie (aj z dát, formulára a profilu), príznaky, matica vyšetrení, ošetrujúci, < 100 riasiniek ako filter.

- Opravy po review (2. 11.): F06 hallmark = **len defekt na TEM** (genetika a IF sú podporné nálezy – genetika sama nie je diagnostické kritérium); pri zhode text „Kontrola prebehla – AI sa neozvala“ (nie „súhlasí“). Výsledky podobných sú len na požiadanie (AI panel), aby neovplyvnili úsudok pred F06. Ošetrujúci je v dátach vždy klinik (Vojtech), lab je na prípadoch cez `sharedWith`; „Pridať pacienta“ len klinik; filter „Zdieľal“ zrušený. Stav odoslania TEM správy je v `store.ts` (`reportSent`) – zdieľa ho TEM tab aj fronta. Pravidlá F06 a definície frontov treba overiť s Dominikou.

- Anamnéza (3. 11.): `Patient.anamnesis` môže byť `null` = nezapísaná (lekár ju má v UNIS, prepísanie je dobrovoľné). Nový pacient z flow 1 ju má prázdnu. Tab Anamnéza → „Vyplniť / Upraviť anamnézu“ (`AnamnesisModal` vo `Forms.tsx`, len Vojtech, živý PICADAR + klinický index, `saveAnamnesis` v `store.ts`). Bez anamnézy: PICADAR/index „Bez anamnézy“, v tabuľke „nevyplnená“, filtre anamnézy pacienta nezahrnú, AI podobnosť atribúty anamnézy neporovnáva (nepočíta ich ako zhodu „nie“).

- Taby zrušené (5. 11.): rozhodnutie Adky – prototyp rieši **jednu organizáciu**, pojem organizácia sa v UI nerieši, všetci vidia všetkých pacientov. Taby Moji/Zdieľaní/Všetci aj položka „Zdieľané prípady“ v sidebare sú preč, hľadanie a filtre sú v jednom riadku. Zdieľanie (flow 5, 6) zatiaľ nie je.

Ďalej: 8. WoZ panel + testovacie scenáre. Z Majkinho návrhu chýba Collaboration (zdieľanie s oprávneniami, diskusia), My Organization, logo PCDAid.

Kľúčoví pacienti na testovanie: **PCD-0142** (nejasný: normálny TEM, nízke nNO, rozpor), **PCD-0118** (potvrdená PCD, normálny TEM, DNAH11), **PCD-0087** (vylúčený 2023, kandidát na prehodnotenie), **PCD-0163** (TEM 72/100 riasiniek), **PCD-0171** (prípad stojí 26 dní), **PCD-0141** (nejasný, všetky výsledky hotové, IF v norme, bez hallmark → „Pripravené na záver“), **PCD-0172 až 0175** (čerstvo od pediatra, len anamnéza ± nNO, TEM bez snímok → test flow 3 upload; **PCD-0174** nemá anamnézu prepísanú → test vyplnenia anamnézy).

Otvorené otázky pre Adku: priveľa stĺpcov v tabuľke? „Nejasné prípady“ ako hero karta? Priveľa AI naraz v profile? Reálne údaje pre taby HSVM/IF/Genetika a šablóna TEM správy od Dominiky. Prístup podľa roly (lab nevidí genetiku?) zatiaľ neriešený.
