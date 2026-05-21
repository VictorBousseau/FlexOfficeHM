-- Flex Office — schema initial
-- A executer dans l'editeur SQL Supabase (ou via la CLI Supabase).

-- ============================================================
-- Tables
-- ============================================================

create table if not exists desks (
  id text primary key,             -- ex: '3.06-1', '3.13-2', 'OS4_1-1', 'SDR1-1'
  label text not null,             -- affiche a l'utilisateur (format avec point pour les OS)
  bureau_group text not null,      -- ex: '3.06', '3.13', 'OS4.1', 'OS6', 'SDR1', 'SDR2'
  kind text not null check (kind in ('individual','openspace','meeting_room')),
  display_order integer not null
);

create table if not exists bookings (
  id uuid primary key default gen_random_uuid(),
  desk_id text not null references desks(id) on delete cascade,
  date date not null,
  slot text not null check (slot in ('morning','afternoon')),
  user_name text not null check (length(trim(user_name)) > 0),
  created_at timestamptz default now()
);

-- Une seule personne par place et par creneau
create unique index if not exists bookings_unique_idx on bookings(desk_id, date, slot);
create index if not exists bookings_date_slot_idx on bookings(date, slot);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table desks enable row level security;
alter table bookings enable row level security;

-- desks : lecture seule pour anon
drop policy if exists desks_select_anon on desks;
create policy desks_select_anon on desks
  for select to anon, authenticated using (true);

-- bookings : select / insert / delete ouverts pour anon
drop policy if exists bookings_select_anon on bookings;
create policy bookings_select_anon on bookings
  for select to anon, authenticated using (true);

drop policy if exists bookings_insert_anon on bookings;
create policy bookings_insert_anon on bookings
  for insert to anon, authenticated with check (true);

drop policy if exists bookings_delete_anon on bookings;
create policy bookings_delete_anon on bookings
  for delete to anon, authenticated using (true);

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table bookings;

-- ============================================================
-- Seed des 47 places reservables
-- ============================================================

-- Bureaux individuels a 1 place (7 bureaux)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('3.06-1', 'Bureau 3.06', '3.06', 'individual', 1),
  ('3.07-1', 'Bureau 3.07', '3.07', 'individual', 2),
  ('3.08-1', 'Bureau 3.08', '3.08', 'individual', 3),
  ('3.10-1', 'Bureau 3.10', '3.10', 'individual', 4),
  ('3.11-1', 'Bureau 3.11', '3.11', 'individual', 5),
  ('3.12-1', 'Bureau 3.12', '3.12', 'individual', 6),
  ('3.33-1', 'Bureau 3.33', '3.33', 'individual', 7)
on conflict (id) do nothing;

-- Bureaux individuels a 2 places (5 bureaux x 2 = 10 places)
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
  ('3.34-2', 'Bureau 3.34 - place 2', '3.34', 'individual', 17)
on conflict (id) do nothing;

-- Open Space 4.1 (4 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS4_1-1', 'OS4.1 - place 1', 'OS4.1', 'openspace', 18),
  ('OS4_1-2', 'OS4.1 - place 2', 'OS4.1', 'openspace', 19),
  ('OS4_1-3', 'OS4.1 - place 3', 'OS4.1', 'openspace', 20),
  ('OS4_1-4', 'OS4.1 - place 4', 'OS4.1', 'openspace', 21)
on conflict (id) do nothing;

-- Open Space 4.2 (4 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS4_2-1', 'OS4.2 - place 1', 'OS4.2', 'openspace', 22),
  ('OS4_2-2', 'OS4.2 - place 2', 'OS4.2', 'openspace', 23),
  ('OS4_2-3', 'OS4.2 - place 3', 'OS4.2', 'openspace', 24),
  ('OS4_2-4', 'OS4.2 - place 4', 'OS4.2', 'openspace', 25)
on conflict (id) do nothing;

-- Open Space 4.3 (4 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS4_3-1', 'OS4.3 - place 1', 'OS4.3', 'openspace', 26),
  ('OS4_3-2', 'OS4.3 - place 2', 'OS4.3', 'openspace', 27),
  ('OS4_3-3', 'OS4.3 - place 3', 'OS4.3', 'openspace', 28),
  ('OS4_3-4', 'OS4.3 - place 4', 'OS4.3', 'openspace', 29)
on conflict (id) do nothing;

-- Open Space 6 (6 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('OS6-1', 'OS6 - place 1', 'OS6', 'openspace', 30),
  ('OS6-2', 'OS6 - place 2', 'OS6', 'openspace', 31),
  ('OS6-3', 'OS6 - place 3', 'OS6', 'openspace', 32),
  ('OS6-4', 'OS6 - place 4', 'OS6', 'openspace', 33),
  ('OS6-5', 'OS6 - place 5', 'OS6', 'openspace', 34),
  ('OS6-6', 'OS6 - place 6', 'OS6', 'openspace', 35)
on conflict (id) do nothing;

-- Salle de reunion 1 (6 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('SDR1-1', 'Salle reunion 1 - place 1', 'SDR1', 'meeting_room', 36),
  ('SDR1-2', 'Salle reunion 1 - place 2', 'SDR1', 'meeting_room', 37),
  ('SDR1-3', 'Salle reunion 1 - place 3', 'SDR1', 'meeting_room', 38),
  ('SDR1-4', 'Salle reunion 1 - place 4', 'SDR1', 'meeting_room', 39),
  ('SDR1-5', 'Salle reunion 1 - place 5', 'SDR1', 'meeting_room', 40),
  ('SDR1-6', 'Salle reunion 1 - place 6', 'SDR1', 'meeting_room', 41)
on conflict (id) do nothing;

-- Salle de reunion 2 (6 places)
insert into desks (id, label, bureau_group, kind, display_order) values
  ('SDR2-1', 'Salle reunion 2 - place 1', 'SDR2', 'meeting_room', 42),
  ('SDR2-2', 'Salle reunion 2 - place 2', 'SDR2', 'meeting_room', 43),
  ('SDR2-3', 'Salle reunion 2 - place 3', 'SDR2', 'meeting_room', 44),
  ('SDR2-4', 'Salle reunion 2 - place 4', 'SDR2', 'meeting_room', 45),
  ('SDR2-5', 'Salle reunion 2 - place 5', 'SDR2', 'meeting_room', 46),
  ('SDR2-6', 'Salle reunion 2 - place 6', 'SDR2', 'meeting_room', 47)
on conflict (id) do nothing;
