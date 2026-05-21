# Prompt pour Claude Code — App Flex Office (VERSION FINALE)

> Copier-coller ce prompt entier dans Claude Code, dans un dossier vide.
> Le fichier `floor-plan-raw.svg` est dans le même dossier.

---

## Contexte

Je suis Victor, Data Analyst en alternance chez Harmonie Mutuelle, équipe Distribution & Performance Commerciale (Rennes, 3ème étage). Nous travaillons en flex office. L'étage contient :
- Des bureaux numérotés (parfois à 1 place, parfois à 2 places)
- 4 open spaces (OS4.1, OS4.2, OS4.3 à 4 places chacun, OS6 à 6 places)
- 2 salles de réunion utilisées comme espaces de travail (SDR1 et SDR2, 6 places chacune)

**Total : 47 places réservables**

Aujourd'hui les réservations se font sur un Excel partagé, ce qui pose des problèmes de concurrence et de visibilité. Je veux une web app simple.

L'app est destinée à mon équipe en interne, hébergée sur Vercel, données sur Supabase free tier. Aucune donnée personnelle ou interne sensible n'est stockée — uniquement des prénoms saisis librement par les utilisateurs.

## Stack imposée

- **Next.js 14** avec App Router et TypeScript strict
- **Tailwind CSS** pour le styling
- **shadcn/ui** pour les composants (Button, Dialog, Toast, Card, Tabs)
- **Supabase** comme BDD Postgres (client `@supabase/supabase-js`)
- **date-fns** pour la manipulation des dates (avec locale `fr`)
- **lucide-react** pour les icônes
- Déploiement final sur **Vercel**

## Modèle de données

**Principe clé** : chaque siège physique réservable est une ligne dans `desks`. Une place ne peut être occupée que par 1 personne par demi-journée.

**Note sur la convention d'ID** :
- Dans le SVG et l'UI affichée à l'utilisateur : points conservés (`OS4.1-1`, `OS4.2-3`, `3.06-1`)
- Dans les IDs Supabase et les sélecteurs CSS : les points dans les zones open space sont remplacés par tirets bas (`OS4_1-1`, `OS4_2-3`). Pour les bureaux numérotés, les points restent (`3.06-1`) car ils ne sont pas utilisés comme sélecteurs CSS directement (on utilise `data-desk-id` à la place).
- Transformation à l'intégration SVG : remplacer `OS4.1-X` → `OS4_1-X`, `OS4.2-X` → `OS4_2-X`, `OS4.3-X` → `OS4_3-X`
- Les bureaux `3.06-1`, `3.13-2`, etc. gardent leur format inchangé

### Table `desks`
```sql
create table desks (
  id text primary key,             -- ex: '3.06-1', '3.13-2', 'OS4_1-1', 'SDR1-1'
  label text not null,             -- affiché à l'utilisateur, format avec point pour les OS
  bureau_group text not null,      -- ex: '3.06', '3.13', 'OS4.1', 'OS6', 'SDR1', 'SDR2'
  kind text not null check (kind in ('individual','openspace','meeting_room')),
  display_order integer not null
);
```

### Seed à insérer (47 lignes)

```sql
-- Bureaux individuels à 1 place (7 bureaux)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('3.06-1', 'Bureau 3.06', '3.06', 'individual', 1),
  ('3.07-1', 'Bureau 3.07', '3.07', 'individual', 2),
  ('3.08-1', 'Bureau 3.08', '3.08', 'individual', 3),
  ('3.10-1', 'Bureau 3.10', '3.10', 'individual', 4),
  ('3.11-1', 'Bureau 3.11', '3.11', 'individual', 5),
  ('3.12-1', 'Bureau 3.12', '3.12', 'individual', 6),
  ('3.33-1', 'Bureau 3.33', '3.33', 'individual', 7);

-- Bureaux individuels à 2 places (5 bureaux × 2 = 10 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('3.09-1', 'Bureau 3.09 - place 1', '3.09', 'individual', 8),
  ('3.09-2', 'Bureau 3.09 - place 2', '3.09', 'individual', 9),
  ('3.13-1', 'Bureau 3.13 - place 1', '3.13', 'individual', 10),
  ('3.13-2', 'Bureau 3.13 - place 2', '3.13', 'individual', 11),
  ('3.14-1', 'Bureau 3.14 - place 1', '3.14', 'individual', 12),
  ('3.14-2', 'Bureau 3.14 - place 2', '3.14', 'individual', 13),
  ('3.32-1', 'Bureau 3.32 - place 1', '3.32', 'individual', 14),
  ('3.32-2', 'Bureau 3.32 - place 2', '3.32', 'individual', 15),
  ('3.34-1', 'Bureau 3.34 - place 1', '3.34', 'individual', 16),
  ('3.34-2', 'Bureau 3.34 - place 2', '3.34', 'individual', 17);

-- Open Space 4.1 (4 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS4_1-1', 'OS4.1 - place 1', 'OS4.1', 'openspace', 18),
  ('OS4_1-2', 'OS4.1 - place 2', 'OS4.1', 'openspace', 19),
  ('OS4_1-3', 'OS4.1 - place 3', 'OS4.1', 'openspace', 20),
  ('OS4_1-4', 'OS4.1 - place 4', 'OS4.1', 'openspace', 21);

-- Open Space 4.2 (4 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS4_2-1', 'OS4.2 - place 1', 'OS4.2', 'openspace', 22),
  ('OS4_2-2', 'OS4.2 - place 2', 'OS4.2', 'openspace', 23),
  ('OS4_2-3', 'OS4.2 - place 3', 'OS4.2', 'openspace', 24),
  ('OS4_2-4', 'OS4.2 - place 4', 'OS4.2', 'openspace', 25);

-- Open Space 4.3 (4 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS4_3-1', 'OS4.3 - place 1', 'OS4.3', 'openspace', 26),
  ('OS4_3-2', 'OS4.3 - place 2', 'OS4.3', 'openspace', 27),
  ('OS4_3-3', 'OS4.3 - place 3', 'OS4.3', 'openspace', 28),
  ('OS4_3-4', 'OS4.3 - place 4', 'OS4.3', 'openspace', 29);

-- Open Space 6 (6 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS6-1', 'OS6 - place 1', 'OS6', 'openspace', 30),
  ('OS6-2', 'OS6 - place 2', 'OS6', 'openspace', 31),
  ('OS6-3', 'OS6 - place 3', 'OS6', 'openspace', 32),
  ('OS6-4', 'OS6 - place 4', 'OS6', 'openspace', 33),
  ('OS6-5', 'OS6 - place 5', 'OS6', 'openspace', 34),
  ('OS6-6', 'OS6 - place 6', 'OS6', 'openspace', 35);

-- Salle de réunion 1 (6 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('SDR1-1', 'Salle réunion 1 - place 1', 'SDR1', 'meeting_room', 36),
  ('SDR1-2', 'Salle réunion 1 - place 2', 'SDR1', 'meeting_room', 37),
  ('SDR1-3', 'Salle réunion 1 - place 3', 'SDR1', 'meeting_room', 38),
  ('SDR1-4', 'Salle réunion 1 - place 4', 'SDR1', 'meeting_room', 39),
  ('SDR1-5', 'Salle réunion 1 - place 5', 'SDR1', 'meeting_room', 40),
  ('SDR1-6', 'Salle réunion 1 - place 6', 'SDR1', 'meeting_room', 41);

-- Salle de réunion 2 (6 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('SDR2-1', 'Salle réunion 2 - place 1', 'SDR2', 'meeting_room', 42),
  ('SDR2-2', 'Salle réunion 2 - place 2', 'SDR2', 'meeting_room', 43),
  ('SDR2-3', 'Salle réunion 2 - place 3', 'SDR2', 'meeting_room', 44),
  ('SDR2-4', 'Salle réunion 2 - place 4', 'SDR2', 'meeting_room', 45),
  ('SDR2-5', 'Salle réunion 2 - place 5', 'SDR2', 'meeting_room', 46),
  ('SDR2-6', 'Salle réunion 2 - place 6', 'SDR2', 'meeting_room', 47);
```

### Table `bookings`
```sql
create table bookings (
  id uuid primary key default gen_random_uuid(),
  desk_id text not null references desks(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('morning','afternoon')),
  user_name text not null check (length(trim(user_name)) > 0),
  created_at timestamptz default now()
);

-- Une seule personne par place et par créneau
create unique index bookings_unique_idx on bookings(desk_id, date, slot);
create index bookings_date_slot_idx on bookings(date, slot);
```

### Row Level Security
- Activer RLS sur `bookings` et `desks`
- Policies sur `bookings` : `select`, `insert`, `delete` ouverts à `anon`
- Policies sur `desks` : `select` ouvert à `anon`, pas d'insert/update/delete via l'API

## Règles métier (CRITIQUES)

1. **Demi-journées** : chaque réservation est sur un créneau `morning` ou `afternoon`. Une personne peut réserver matin sur la place A et après-midi sur la place B le même jour.

2. **Pas de double-résa d'un même nom sur un même créneau** : si "Victor" a déjà réservé une place le 02/06 matin, il ne peut pas en réserver une autre le 02/06 matin. Vérifier côté app avant `insert` : matching sur `lower(trim(user_name))`.

3. **1 personne max par place et par créneau** : géré par la contrainte SQL `unique index`.

4. **Affichage groupé par `bureau_group`** : visuellement et dans les tableaux récap, les places d'un même bureau ou d'une même zone sont regroupées. Compteur "X/N occupé" par zone.

5. **Fenêtre de réservation à 3 semaines (palier hebdomadaire)** :
   - `monday(N)` = lundi de la semaine courante (timezone Europe/Paris)
   - Jours réservables : du lundi `monday(N)` au vendredi de la semaine `N+2` (3 semaines visibles)
   - Chaque lundi à 00h00, automatiquement la semaine N+2 devient réservable et la semaine N-1 disparaît
   - **Pas de réservation possible le week-end**
   - **Jours fériés français** non bloqués en V1 (prévoir `// TODO: bloquer jours fériés`)

6. **Pseudo mémorisé** : à la première utilisation, demander le prénom dans une modale, stocker en `localStorage` (clé `flex-office-user-name`). Bouton "Changer mon nom" dans le header.

7. **Annulation** : un utilisateur peut annuler ses propres réservations (matching sur `lower(trim(user_name))`).

## Plan SVG — workflow d'intégration

**IMPORTANT** : dans le même dossier que ce prompt, tu trouves le fichier `floor-plan-raw.svg`. C'est mon export Excalidraw. Le plan contient :

- Des **carrés orange** = places réservables, chacun avec un label textuel à proximité (ex: `3.06-1`, `OS4.1-1`, `SDR1-1`)
- Des **carrés gris** = places non réservables (à laisser intactes, sans `data-desk-id`)
- Des **labels indicatifs** sans suffixe (ex: `3.06`, `3.32`, `3.33`...) = numéro du bureau affiché pour repère visuel. **À IGNORER pour le matching.** Ces labels sont reconnaissables : ils matchent l'expression `^3\.\d+$` (pas de tiret + chiffre derrière).
- Des **labels de zone** (`Open space 4.1`, `Salle de réunion`, etc.) = à laisser intacts, purement décoratifs
- Du **texte libre** (Cuisine, WC, Ascenseur, Escalier) = à laisser intact

### Liste exhaustive des 47 deskIds attendus

Bureaux individuels (17 places) :
`3.06-1`, `3.07-1`, `3.08-1`, `3.09-1`, `3.09-2`, `3.10-1`, `3.11-1`, `3.12-1`, `3.13-1`, `3.13-2`, `3.14-1`, `3.14-2`, `3.32-1`, `3.32-2`, `3.33-1`, `3.34-1`, `3.34-2`

Open spaces (18 places) :
`OS4.1-1` à `OS4.1-4`, `OS4.2-1` à `OS4.2-4`, `OS4.3-1` à `OS4.3-4`, `OS6-1` à `OS6-6`

Salles de réunion (12 places) :
`SDR1-1` à `SDR1-6`, `SDR2-1` à `SDR2-6`

### Ta tâche en 5 étapes :

1. **Parse le SVG** pour identifier chaque `<rect>` orange et chaque `<text>` associé.

2. **Filtre les labels** :
   - Labels de places (à matcher) : matchent `^3\.\d+-\d+$` OU commencent par `OS` OU commencent par `SDR`
   - Labels à ignorer : `^3\.\d+$` (sans suffixe), labels contenant "Open space", "Salle de réunion", "Cuisine", "WC", "Ascenseur", "Escalier"

3. **Associe chaque rectangle orange à son label de place** par proximité géographique (distance euclidienne entre le centre du rect et le centre du label).

4. **Transforme le label SVG en deskId Supabase** :
   - `3.06-1` → `3.06-1` (inchangé)
   - `OS4.1-1` → `OS4_1-1` (point → tiret bas, uniquement pour OS4.1/4.2/4.3)
   - `OS6-1` → `OS6-1` (inchangé)
   - `SDR1-1` → `SDR1-1` (inchangé)

5. **Ajoute sur chaque `<rect>` orange réservable** les attributs :
   - `id="desk-<deskId>"` 
   - `data-desk-id="<deskId>"`
   - `style="cursor: pointer"` et `tabindex="0"`

6. **Vérifie** : les 47 IDs Supabase doivent tous être présents et uniques. Si un ID manque, ou si un rectangle orange n'a pas de label de place associé, **ARRÊTE** et liste-moi les problèmes avec leurs coordonnées (x, y).

### Composant FloorPlan.tsx à produire :

- Affiche le SVG en responsive (`viewBox` conservé, `width: 100%`)
- Props : `bookings: Booking[]`, `currentUserName: string`, `onDeskClick: (deskId: string) => void`
- Pour chaque `<rect data-desk-id="...">`, couleur de fond dynamique :
  - **Vert** (`#bbf7d0`) si libre
  - **Rouge** (`#fecaca`) si occupé par quelqu'un d'autre
  - **Bleu** (`#bfdbfe`) si occupé par l'utilisateur courant
- Au clic : appelle `onDeskClick(deskId)`
- Tooltip natif (`<title>` enfant du `<rect>`) avec le nom de l'occupant si occupé
- Garde les rectangles gris non cliquables et les labels indicatifs intacts
- Préserve tous les autres éléments visuels (textes "Cuisine", numéros de bureau, labels de zones)

## Pages et composants

### `/` (page principale)
- Header : titre "Flex Office — 3ème étage Rennes", bouton "Changer mon nom" (affiche pseudo courant), lien "Mes réservations"
- **Sélecteur de jour** : 3 onglets de semaine (S, S+1, S+2), et dans chaque semaine 5 onglets (Lundi → Vendredi). Date format `EEEE d MMM` (fr).
- **Sélecteur de créneau** : toggle Matin / Après-midi (par défaut Matin si heure < 13h, sinon Après-midi)
- **Plan SVG cliquable** (`<FloorPlan />`)
- **Au clic** :
  - Libre → modale "Réserver `<label>` le `<date>` `<slot>` ?"
  - Occupée par moi → modale "Annuler ma réservation sur `<label>` ?"
  - Occupée par autre → toast "Place occupée par `<nom>`"
- **Sous le plan** : tableau récapitulatif du créneau, 3 sections (Bureaux individuels / Open spaces / Salles de réunion), regroupé par `bureau_group`, colonnes : Place, Occupant, Action
- **Compteurs zones** : ratio "X/N occupé" pour chaque zone multi-places

### `/mes-reservations`
- Liste des résas du pseudo courant (futures uniquement, ordonnées par date)
- Groupées par date
- Bouton "Annuler" avec confirmation

### Composants
- `<FloorPlan />`, `<BookingModal />`, `<NamePromptModal />`, `<WeekDayPicker />`, `<SlotToggle />`, `<OccupantsTable />`

## Logique métier — `lib/booking-rules.ts`

```typescript
export function getReservableDates(today?: Date): Date[]

export function canBook(params: {
  userName: string;
  date: Date;
  slot: 'morning' | 'afternoon';
  existingBookings: Booking[];
}): { ok: true } | { ok: false; reason: string }

export function getDeskStatus(params: {
  deskId: string;
  date: Date;
  slot: 'morning' | 'afternoon';
  bookings: Booking[];
  currentUserName: string;
}): 'free' | 'mine' | 'occupied'

export function getGroupOccupancy(params: {
  bureauGroup: string;
  date: Date;
  slot: 'morning' | 'afternoon';
  desks: Desk[];
  bookings: Booking[];
}): { occupied: number; total: number }

export function normalizeName(name: string): string
```

Toutes pures, pas d'appel Supabase à l'intérieur.

## Critères d'acceptation

- [ ] Première visite : modale de saisie du prénom
- [ ] Plan SVG avec les 47 places correctement positionnées
- [ ] Navigation dans 3 semaines uniquement (pas de S+3)
- [ ] Pas de week-end
- [ ] Réserver une place matin + une autre l'après-midi du même jour OK
- [ ] Réserver 2 places sur le même créneau impossible (alerte explicite)
- [ ] Compteurs d'occupation par zone (X/N) corrects en temps réel
- [ ] Tooltips affichent le nom de l'occupant
- [ ] Annulation depuis le plan et depuis `/mes-reservations`
- [ ] Changer le pseudo depuis le header
- [ ] Variables Vercel `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] TypeScript strict, sans `any`
- [ ] Realtime Supabase : updates en live entre utilisateurs
- [ ] Mobile-friendly : plan lisible sur écran ≥ 360px (scroll horizontal si besoin)
- [ ] Bureaux gris non cliquables

## Étapes d'exécution

1. **Lire `floor-plan-raw.svg`**, identifier rectangles orange + labels, transformer en deskIds Supabase, vérifier les 47 IDs. SI mismatch → arrêter et lister.
2. **Init projet** : `npx create-next-app@latest .` (TS, Tailwind, App Router, ESLint, src/ dir, imports `@/*`)
3. **Install deps** : `@supabase/supabase-js`, `date-fns`, `lucide-react`, `npx shadcn@latest init` puis add `button` `dialog` `card` `tabs` `sonner`
4. **Setup Supabase** : `lib/supabase.ts` + `.env.local` (placeholders) + `.gitignore`
5. **Migration SQL** : `supabase/migrations/0001_init.sql` avec tables + contraintes + RLS + seed des 47 places
6. **Types** : `types/database.ts`
7. **Logique métier pure** : `lib/booking-rules.ts`
8. **Hook user** : `lib/use-current-user.ts` (localStorage avec guard SSR)
9. **Composant FloorPlan**
10. **Modales** : NamePromptModal, BookingModal
11. **Page principale**
12. **Realtime Supabase**
13. **Page /mes-reservations**
14. **README.md** avec setup complet

## Notes techniques

- **Pas de Server Actions** en V1, tout client components avec fetch direct Supabase
- **Toujours `format(d, 'yyyy-MM-dd')`** de date-fns (jamais `toISOString().slice(0,10)`)
- **Pas d'i18n** : tout en français, locale `fr`
- **Accessibilité** : `aria-label` sur les places SVG, focus visible, `<title>` SVG pour tooltips
- **Gestion d'erreur Supabase** : toujours un toast en cas d'échec
- **IDs avec points** : `document.querySelector('#desk-3.06-1')` échoue (interprété comme classes CSS). Utiliser `document.querySelector('[data-desk-id="3.06-1"]')`.

## Démarrage

1. Lire `floor-plan-raw.svg` et confirmer que les 47 deskIds sont détectables
2. Si OK, enchaîner sans redemander confirmation jusqu'à un livrable testable
3. Si problème dans le SVG, lister les mismatch avec coordonnées et attendre mon correctif

Go.
