# Flex Office — 3ème étage Rennes

Application interne de réservation de bureaux en flex office pour l'équipe
**Distribution & Performance Commerciale** d'Harmonie Mutuelle (Rennes, 3ème étage).

Elle remplace l'Excel partagé : plan interactif, réservation à la demi-journée,
mise à jour en temps réel entre utilisateurs.

**47 places réservables** : 12 bureaux numérotés (17 places), 4 open spaces
(18 places), 2 salles de réunion utilisées comme espaces de travail (12 places).

## Stack

- **Next.js 14** (App Router) + **TypeScript strict**
- **Tailwind CSS** + **shadcn/ui** (Radix UI)
- **Supabase** (Postgres + Realtime, plan gratuit)
- **date-fns** (locale `fr`) · **lucide-react** · **sonner** (toasts)
- Déploiement **Vercel**

## Prérequis

- **Node.js 18.17+** (testé avec Node 24)
- Un compte **Supabase** (gratuit) et un compte **Vercel** pour le déploiement

## Installation locale

### 1. Dépendances

```bash
npm install
```

### 2. Base de données Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Ouvrir **SQL Editor** et exécuter, dans l'ordre :
   - [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
     — tables `desks`/`bookings`, contraintes, RLS, Realtime, seed des
     **47 places**.
   - [`supabase/migrations/0002_booking_events.sql`](supabase/migrations/0002_booking_events.sql)
     — table `booking_events` + triggers qui journalisent automatiquement
     chaque réservation et chaque annulation (alimente la page
     **Historique**).
3. Vérifier dans **Table Editor** que `desks` contient bien 47 lignes.

> Les scripts sont idempotents (`if not exists` / `on conflict do nothing`) :
> ils peuvent être ré-exécutés sans risque.

### 3. Variables d'environnement

Copier `.env.example` en `.env.local` et renseigner les valeurs du projet
(Supabase > **Project Settings** > **API**) :

```
NEXT_PUBLIC_SUPABASE_URL=https://votreprojet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

`.env.local` est ignoré par git et ne doit **jamais** être commité.

### 4. Lancer en développement

```bash
npm run dev
```

L'application est disponible sur <http://localhost:3000>.

## Scripts

| Commande         | Rôle                                          |
| ---------------- | --------------------------------------------- |
| `npm run dev`    | Serveur de développement                      |
| `npm run build`  | Build de production (lint + vérification TS)  |
| `npm run start`  | Sert le build de production                   |
| `npm run lint`   | ESLint                                        |

## Déploiement Vercel

1. Importer le dépôt dans Vercel (framework détecté : Next.js).
2. Renseigner les variables d'environnement `NEXT_PUBLIC_SUPABASE_URL` et
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (onglet **Settings > Environment Variables**).
3. Déployer. Aucune configuration supplémentaire n'est nécessaire.

## Plan SVG

Le plan provient d'un export Excalidraw (`floor-plan-raw.svg`). Le script
[`scripts/process-svg.mjs`](scripts/process-svg.mjs) :

- identifie les 47 carrés réservables (remplissage orange `#ffd8a8`) ;
- les associe à leur label de place par proximité géométrique ;
- transforme les labels en `deskId` Supabase (`OS4.1-1` → `OS4_1-1`) ;
- injecte `data-desk-id`, `id`, `role`, `tabindex` et un `<title>` sur chaque
  place, puis écrit `public/floor-plan.svg`.

Excalidraw exporte les formes en `<g>`/`<path>` (et non en `<rect>`) :
les attributs `data-desk-id` sont donc portés par les `<g>`, et le composant
`FloorPlan` recolore le `<path class="desk-fill">` interne.

Pour régénérer le plan après une modification de `floor-plan-raw.svg` :

```bash
node scripts/process-svg.mjs
```

## Règles métier

- Fenêtre de réservation : semaine courante + 2 semaines (15 jours ouvrés).
- Réservation à la **journée entière** ou à la **demi-journée** (`matin` /
  `après-midi`). Une journée = deux lignes dans `bookings` (matin + après-midi).
- Une personne ne peut avoir **qu'une réservation par créneau** (tous bureaux confondus).
- Une place = **1 personne max** par créneau (contrainte SQL `unique`).
- Pas de week-end. Jours fériés non bloqués en V1.
- Identification par **prénom libre** mémorisé en `localStorage`
  (matching insensible à la casse).
- Toutes les réservations et annulations sont journalisées dans
  `booking_events` via un trigger Postgres → page **Historique** pour
  reconstituer la chronologie en cas de conflit.

## Structure

```
src/
  app/
    page.tsx                  Plan + réservation (vue journée)
    mes-reservations/page.tsx Réservations à venir de l'utilisateur
    historique/page.tsx       Journal des réservations et annulations
    layout.tsx · globals.css
  components/
    FloorPlan · WeekDayPicker
    BookingModal · NamePromptModal · OccupantsTable · Header
    ui/                       Composants shadcn/ui
  lib/
    supabase.ts               Client Supabase
    booking-rules.ts          Logique métier pure (testable)
    use-current-user.ts       Hook pseudo / localStorage
  types/database.ts           Types Desk / Booking / BookingEvent
supabase/migrations/
  0001_init.sql               Schéma + 47 places + RLS + Realtime
  0002_booking_events.sql     Historique (table + triggers)
scripts/process-svg.mjs       Traitement du plan SVG
public/floor-plan.svg         Plan traité (généré)
```

## Notes

- Aucune donnée personnelle sensible n'est stockée : uniquement des prénoms
  saisis librement.
- RLS activée : `desks` en lecture seule, `bookings` en select/insert/delete
  pour le rôle `anon`.
- Realtime Supabase activé sur `bookings` : les réservations des collègues
  apparaissent sans rechargement.
