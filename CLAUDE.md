# CLAUDE.md — Flex Office App

## Contexte projet

App interne de réservation de bureaux en flex office pour l'équipe Distribution & Performance Commerciale d'Harmonie Mutuelle (Rennes, 3ème étage). Stack : Next.js 14 + TypeScript + Tailwind + shadcn/ui + Supabase + Vercel.

**47 places réservables** réparties en :
- 12 bureaux numérotés individuels (7 à 1 place, 5 à 2 places) = 17 places
- 4 open spaces (OS4.1, OS4.2, OS4.3 à 4 places chacun, OS6 à 6 places) = 18 places
- 2 salles de réunion (SDR1 et SDR2) utilisées comme espaces de travail à 6 places nominales chacune = 12 places

## Conventions de code

- **TypeScript strict** : pas de `any`, pas de `// @ts-ignore`. Préférer `unknown` + narrowing.
- **Composants** : function components, hooks. Pas de classes.
- **Nommage** : PascalCase pour composants, camelCase pour fonctions/variables, kebab-case pour fichiers de pages, PascalCase pour fichiers de composants.
- **Imports absolus** depuis `@/` (configuré dans `tsconfig.json`).
- **Tailwind** : classes utilitaires, pas de fichiers CSS séparés sauf `globals.css`.
- **Dates** : toujours via `date-fns` avec locale `fr`. Format SQL : `YYYY-MM-DD` via `format(d, 'yyyy-MM-dd')`.

## Conventions d'IDs (CRITIQUE)

- **IDs Supabase open spaces** : tirets bas (`OS4_1-1`, `OS4_2-3`, `OS4_3-2`)
- **Labels SVG open spaces** : points conservés (`OS4.1-1`, `OS4.2-3`)
- **Labels UI utilisateur** : points conservés (`OS4.1 - place 1`)
- **Bureaux numérotés** : format inchangé partout (`3.06-1`, `3.13-2`)
- **Salles de réunion** : format inchangé (`SDR1-1`, `SDR2-3`)
- **Transformation à l'intégration SVG** : pour les open spaces uniquement, `replace('.', '_')` dans l'ID

## Règles métier critiques

1. Fenêtre de réservation = semaine courante + 2 semaines suivantes (3 semaines, lundi → vendredi)
2. Une personne ne peut avoir QU'UNE réservation par créneau (matin OU après-midi) sur l'ensemble des bureaux
3. Une place = 1 personne max par créneau (contrainte SQL unique)
4. Pas de week-end. Pas de gestion jours fériés en V1.
5. Matching utilisateur par nom (insensible casse + trim). Pseudo en localStorage.
6. **Privatisation de salle** : une salle de réunion peut être réservée en entier. Ce n'est pas un objet métier distinct — c'est un LOT de réservations classiques (toutes les places de la salle, même créneau, même nom) partageant un `room_booking_id`. La contrainte unique reste donc le garde-fou anti-collision.
7. Une privatisation **consomme le créneau de la personne** au même titre qu'une place : la règle n°2 reste vraie malgré les 6 lignes insérées. Un créneau privatisé ne se gère jamais place par place (annuler une ligne casserait le lot).
8. Les **événements d'équipe** (`day_events`) sont purement informatifs : rattachés à une date et éventuellement à un créneau, ils ne bloquent aucune place. Création et suppression libres, journalisées dans `day_event_logs`.
9. **Périmètre statistique : les salles de réunion sont exclues** de tous les compteurs et de toutes les statistiques (`kind <> 'meeting_room'`). SDR1/SDR2 servent aussi de salles de séminaire, leurs privatisations fausseraient les taux. Périmètre restant : 35 places réparties en 16 `bureau_group`. Ces totaux ne sont **jamais codés en dur** — ils sont dérivés de la table `desks` filtrée, pour rester justes si les places évoluent.
10. **Base de calcul des compteurs = la journée entière.** Une place est « occupée » un jour donné dès qu'elle porte une réservation le matin OU l'après-midi : une place prise le matin par A et l'après-midi par B compte pour 1. Un bureau (`bureau_group`) compte pour 1 quel que soit son nombre d'occupants.

## Architecture

```
src/
  app/
    page.tsx
    mes-reservations/page.tsx
    historique/page.tsx
    statistiques/page.tsx
    layout.tsx
    globals.css
  components/
    FloorPlan.tsx
    Header.tsx
    WeekDayPicker.tsx      (+ compteurs d'occupation par jour)
    BookingModal.tsx
    RoomBookingModal.tsx
    NamePromptModal.tsx
    OccupantsTable.tsx
    EventsBanner.tsx
    EventFormModal.tsx
    OccupancyCharts.tsx    (recharts : 3 graphiques de la page stats)
    ui/            (button, card, dialog, input, tabs, sonner)
  lib/
    supabase.ts
    booking-rules.ts       (regles de reservation)
    occupancy-stats.ts     (statistiques d'occupation, pur + teste)
    fetch-all-bookings.ts  (lecture paginee de l'historique)
    use-current-user.ts
    utils.ts
  types/
    database.ts
scripts/
  process-svg.mjs  (floor-plan-raw.svg -> public/floor-plan.svg, lancé à la main)
supabase/
  migrations/
    0001_init.sql            desks + bookings + RLS + seed 47 places
    0002_booking_events.sql  historique des réservations (trigger)
    0003_dual_screen.sql     desks.has_dual_screen
    0004_room_bookings.sql   bookings.room_booking_id + team_label
    0005_day_events.sql      day_events + day_event_logs
```

Les migrations sont **additives et idempotentes** : elles se rejouent dans l'éditeur SQL
Supabase sans perdre les données existantes. Ne jamais introduire de `drop table`,
`delete` ou re-seed destructif de `desks`.

## Pièges connus

- **Supabase RLS** : si select renvoie `[]` alors qu'il y a des données, vérifier les policies (mode anon)
- **Timezone** : ne JAMAIS utiliser `new Date().toISOString()` pour les dates métier — passer par date-fns `format(d, 'yyyy-MM-dd')`
- **SVG responsive** : utiliser `viewBox` et `preserveAspectRatio="xMidYMid meet"`, jamais width/height fixes
- **localStorage SSR** : wrapper les lectures dans `useEffect` pour éviter les erreurs hydration
- **IDs avec points** : `document.querySelector('#desk-3.06-1')` échoue (interprété comme classes CSS). Utiliser `document.querySelector('[data-desk-id="3.06-1"]')`.
- **Labels indicatifs dans le SVG** : les textes `3.06`, `3.32`, etc. sans suffixe sont des repères visuels, à ignorer pour le matching place ↔ rectangle.
- **Enrichissements du SVG à l'exécution** : l'étoile « double écran » et le liseré pointillé « salle privatisée » sont injectés par `FloorPlan.tsx` (effet de recolorisation), pas par `scripts/process-svg.mjs`. Le fichier `public/floor-plan.svg` n'a donc pas à être régénéré pour ces marqueurs. L'étoile est positionnée via `getBBox()` sur le path `.desk-fill` : le `<text>` est frère dans le même `<g>`, donc dans le même repère local — aucun transform à recalculer.
- **Ajouter une place** demande trois modifications en parallèle : le seed SQL, la source Excalidraw + `public/floor-plan.svg` régénéré, et le tableau `expected` codé en dur dans `scripts/process-svg.mjs`.
- **Limite Supabase de 1000 lignes par réponse** : la table `bookings` dépasse déjà ce volume (~2 000 lignes). Toute lecture de l'historique complet doit passer par `fetchAllBookings()` (`lib/fetch-all-bookings.ts`), qui pagine avec `.range()`. Ne jamais afficher de statistiques calculées sur une réponse tronquée.
- **Couleurs des graphiques** : palette catégorielle validée (contraste + daltonisme) — places `#2a78d6`, bureaux `#eb6834`. Les histogrammes sont mono-série, donc une seule teinte. Ne pas improviser de nouvelles couleurs sans revalider.

## Tests

`npm test` (vitest). Seul `lib/occupancy-stats.ts` est couvert pour l'instant — c'est
le candidat naturel pour la suite avec `lib/booking-rules.ts`, tous deux purs et sans
dépendance Supabase. Les cas couverts : exclusion des salles de réunion, bureau à deux
places occupé par une seule personne, place prise le matin et l'après-midi par deux
personnes différentes, jours ouvrés vides comptés à 0 %.

## Variables d'environnement

`.env.local` (à créer, ne JAMAIS commiter) :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
```
