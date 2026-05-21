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

## Architecture

```
src/
  app/
    page.tsx
    mes-reservations/page.tsx
    layout.tsx
    globals.css
  components/
    FloorPlan.tsx
    WeekDayPicker.tsx
    SlotToggle.tsx
    BookingModal.tsx
    NamePromptModal.tsx
    OccupantsTable.tsx
    ui/
  lib/
    supabase.ts
    booking-rules.ts
    use-current-user.ts
  types/
    database.ts
supabase/
  migrations/
    0001_init.sql
```

## Pièges connus

- **Supabase RLS** : si select renvoie `[]` alors qu'il y a des données, vérifier les policies (mode anon)
- **Timezone** : ne JAMAIS utiliser `new Date().toISOString()` pour les dates métier — passer par date-fns `format(d, 'yyyy-MM-dd')`
- **SVG responsive** : utiliser `viewBox` et `preserveAspectRatio="xMidYMid meet"`, jamais width/height fixes
- **localStorage SSR** : wrapper les lectures dans `useEffect` pour éviter les erreurs hydration
- **IDs avec points** : `document.querySelector('#desk-3.06-1')` échoue (interprété comme classes CSS). Utiliser `document.querySelector('[data-desk-id="3.06-1"]')`.
- **Labels indicatifs dans le SVG** : les textes `3.06`, `3.32`, etc. sans suffixe sont des repères visuels, à ignorer pour le matching place ↔ rectangle.

## Variables d'environnement

`.env.local` (à créer, ne JAMAIS commiter) :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
```
