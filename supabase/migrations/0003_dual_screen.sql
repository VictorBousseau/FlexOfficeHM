-- Marquage des postes equipes d'un double ecran.
-- A executer dans l'editeur SQL Supabase apres 0002_booking_events.sql.
--
-- Migration STRICTEMENT ADDITIVE : une colonne en plus sur `desks`, aucune
-- suppression, aucun re-seed. Les tables `bookings` et `booking_events` ne
-- sont pas touchees.

-- ============================================================
-- Colonne
-- ============================================================

alter table desks
  add column if not exists has_dual_screen boolean not null default false;

-- ============================================================
-- Affectation des postes equipes
--
-- Declaratif et idempotent : re-executer ce bloc restitue exactement l'etat
-- decrit ci-dessous (les postes retires des listes repassent a false).
--
-- Deux listes complementaires :
--   groups : un numero de bureau -> TOUTES ses places ('3.09' equipe
--            3.09-1 et 3.09-2)
--   places : une place precise ('3.13-2', 'OS4_1-1', 'SDR1-3')
--
-- Rappel convention d'ID : les open spaces utilisent un tiret bas
-- ('OS4_1-1' et non 'OS4.1-1'), les bureaux numerotes gardent le point.
-- ============================================================

with equipement as (
  select
    -- Bureaux complets (toutes leurs places)
    array[]::text[] as groups,
    -- Places equipees d'un double ecran
    array[
      '3.06-1',
      '3.07-1',
      '3.09-1',
      '3.10-1',
      '3.12-1',
      '3.13-1',
      '3.14-1',
      '3.14-2',
      '3.32-1',
      '3.34-1',
      'OS4_1-1',
      'OS6-5'
    ]::text[] as places
)
update desks d
set has_dual_screen = (
  d.bureau_group = any (e.groups)
  or d.id = any (e.places)
)
from equipement e;

-- ============================================================
-- Controle : doit renvoyer 12 lignes
-- ============================================================

-- select id, label, bureau_group, has_dual_screen
-- from desks
-- where has_dual_screen
-- order by display_order;
