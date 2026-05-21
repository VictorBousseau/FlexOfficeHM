# Guide de démarrage — Flex Office App

## TL;DR — La marche à suivre

1. Crée un projet Supabase (5 min)
2. Crée un dossier vide `flex-office-app`, mets-y les 4 fichiers (CLAUDE.md, PROMPT-CLAUDE-CODE.md, floor-plan-raw.svg, ce README)
3. Lance `claude` dans ce dossier et copie-colle l'instruction de démarrage (voir étape 4 ci-dessous)
4. Configure les variables d'env, exécute la migration SQL, active Realtime, déploie sur Vercel

Détaillé ci-dessous.

## Étape 1 : Créer un projet Supabase (5 min)

1. Va sur https://supabase.com → "New project"
2. Nom : `flex-office`, mot de passe BDD au choix (note-le)
3. Région : `West EU (Paris)` ou `West EU (Ireland)`
4. Plan : Free
5. Une fois créé, va dans **Project Settings → API** et copie :
   - `Project URL` (sera ton `NEXT_PUBLIC_SUPABASE_URL`)
   - `anon public` key (sera ton `NEXT_PUBLIC_SUPABASE_ANON_KEY`)

Garde cet onglet ouvert.

## Étape 2 : Préparer ton dossier de travail

```bash
mkdir flex-office-app
cd flex-office-app
```

Copie dans ce dossier :
- `CLAUDE.md`
- `PROMPT-CLAUDE-CODE.md`
- `floor-plan-raw.svg` (ton plan Excalidraw exporté)
- ce fichier `README-LANCEMENT.md` (référence pour toi)

## Étape 3 : Lancer Claude Code

```bash
claude
```

Dans la session, tape simplement :

> Lis `PROMPT-CLAUDE-CODE.md` puis `CLAUDE.md`. Mon plan SVG est dans `floor-plan-raw.svg`. Procède.

Claude Code va :
1. Lire le SVG et vérifier que les 47 places sont détectables
2. S'il y a un mismatch (rare car le SVG a été validé), il s'arrête et te dit quoi corriger
3. Sinon il enchaîne : init projet → installations → migration → composants → app fonctionnelle

## Étape 4 : Configurer les variables d'environnement

Une fois le projet généré, dans `.env.local` à la racine :
```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
```

## Étape 5 : Exécuter la migration SQL

Dans Supabase → **SQL Editor** → New query → coller le contenu de `supabase/migrations/0001_init.sql` → Run.

Vérifie dans **Table Editor** que `desks` contient bien les 47 lignes.

## Étape 6 : Activer Realtime

Dans Supabase → **Database → Replication** → trouve la table `bookings` → active le toggle pour la publication `supabase_realtime`. Sans ça, les mises à jour live entre utilisateurs ne marcheront pas.

## Étape 7 : Tester en local

```bash
npm run dev
```

Ouvre http://localhost:3000.

**Test rapide multi-utilisateurs :**
1. Saisis "Victor" comme nom
2. Clique sur le bureau 3.06 → confirme la résa
3. Ouvre une fenêtre privée et entre comme "Marie"
4. Marie voit le 3.06 en rouge
5. Marie réserve OS4.1-1 → Victor le voit apparaître en live

## Étape 8 : Déployer sur Vercel

1. Push ton code sur GitHub (repo privé recommandé)
2. Sur vercel.com → "New Project" → import du repo
3. Dans "Environment Variables", ajoute les deux variables Supabase
4. Deploy

URL `https://flex-office-xxx.vercel.app` à partager avec ton équipe.

## Récap : structure complète des 47 places

| Zone | Type | Nb places | DeskIds Supabase |
|---|---|---|---|
| 3.06 | Individuel | 1 | `3.06-1` |
| 3.07 | Individuel | 1 | `3.07-1` |
| 3.08 | Individuel | 1 | `3.08-1` |
| 3.09 | Individuel | 2 | `3.09-1`, `3.09-2` |
| 3.10 | Individuel | 1 | `3.10-1` |
| 3.11 | Individuel | 1 | `3.11-1` |
| 3.12 | Individuel | 1 | `3.12-1` |
| 3.13 | Individuel | 2 | `3.13-1`, `3.13-2` |
| 3.14 | Individuel | 2 | `3.14-1`, `3.14-2` |
| 3.32 | Individuel | 2 | `3.32-1`, `3.32-2` |
| 3.33 | Individuel | 1 | `3.33-1` |
| 3.34 | Individuel | 2 | `3.34-1`, `3.34-2` |
| OS4.1 | Open space | 4 | `OS4_1-1` à `OS4_1-4` |
| OS4.2 | Open space | 4 | `OS4_2-1` à `OS4_2-4` |
| OS4.3 | Open space | 4 | `OS4_3-1` à `OS4_3-4` |
| OS6 | Open space | 6 | `OS6-1` à `OS6-6` |
| SDR1 | Salle réu | 6 | `SDR1-1` à `SDR1-6` |
| SDR2 | Salle réu | 6 | `SDR2-1` à `SDR2-6` |
| **TOTAL** | | **47** | |

## Conseils d'usage avec Claude Code

- **Ne le laisse pas dériver** : s'il propose d'ajouter de l'auth, des notifs ou autre, redirige-le sur la V1 minimale
- **Valide les critères d'acceptation un par un** (liste dans `PROMPT-CLAUDE-CODE.md`)
- **Si bug** : copie l'erreur complète + le code en cause, demande "pourquoi cette erreur ?"
- **Pour itérer plus tard** : crée un fichier `docs/v2-ideas.md` où tu notes les features à ajouter

## Limitations connues de la V1

- Pas de gestion des jours fériés
- Pas d'auth : n'importe qui avec l'URL peut réserver (acceptable car app interne équipe)
- Pas de notification (email / Slack / Teams)
- Pas de stats d'occupation
- Pas de gestion admin (suppression de résa par quelqu'un d'autre)

Features V2 possibles sans refonte d'architecture.
