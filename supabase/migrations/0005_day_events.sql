-- Evenements du jour (anniversaire, competition de cookie, pot de depart...).
-- A executer dans l'editeur SQL Supabase apres 0004_room_bookings.sql.
--
-- Un evenement est purement INFORMATIF : il est rattache a une date (et
-- eventuellement a un creneau) mais ne bloque aucune place.
--
-- Migration STRICTEMENT ADDITIVE : deux nouvelles tables, rien d'existant
-- n'est modifie.

-- ============================================================
-- Table des evenements
-- ============================================================

create table if not exists day_events (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  -- null = journee entiere
  slot text check (slot in ('morning','afternoon')),
  emoji text,
  title text not null check (length(trim(title)) between 1 and 80),
  description text,
  created_by text not null check (length(trim(created_by)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists day_events_date_idx on day_events(date);

-- ============================================================
-- Historique des evenements
-- Meme modele que booking_events : alimente uniquement par un trigger
-- SECURITY DEFINER, lecture seule cote anon.
-- ============================================================

create table if not exists day_event_logs (
  id uuid primary key default gen_random_uuid(),
  log_type text not null check (log_type in ('event_created','event_deleted')),
  day_event_id uuid not null,
  date date not null,
  slot text check (slot in ('morning','afternoon')),
  title text not null,
  user_name text not null,
  event_at timestamptz not null default now()
);

create index if not exists day_event_logs_at_idx
  on day_event_logs(event_at desc);

create or replace function log_day_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into day_event_logs (log_type, day_event_id, date, slot, title, user_name)
    values ('event_created', NEW.id, NEW.date, NEW.slot, NEW.title, NEW.created_by);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into day_event_logs (log_type, day_event_id, date, slot, title, user_name)
    values ('event_deleted', OLD.id, OLD.date, OLD.slot, OLD.title, OLD.created_by);
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_day_event_logs on day_events;
create trigger trg_day_event_logs
  after insert or delete on day_events
  for each row execute function log_day_event();

-- ============================================================
-- Row Level Security
-- day_events     : calquee sur bookings (select / insert / delete ouverts).
--                  Pas de policy update : modifier = supprimer + recreer.
-- day_event_logs : lecture seule, seul le trigger ecrit.
-- ============================================================

alter table day_events enable row level security;

drop policy if exists day_events_select_anon on day_events;
create policy day_events_select_anon on day_events
  for select to anon, authenticated using (true);

drop policy if exists day_events_insert_anon on day_events;
create policy day_events_insert_anon on day_events
  for insert to anon, authenticated with check (true);

drop policy if exists day_events_delete_anon on day_events;
create policy day_events_delete_anon on day_events
  for delete to anon, authenticated using (true);

alter table day_event_logs enable row level security;

drop policy if exists day_event_logs_select_anon on day_event_logs;
create policy day_event_logs_select_anon on day_event_logs
  for select to anon, authenticated using (true);

-- ============================================================
-- Realtime
-- `alter publication ... add table` echoue si la table y est deja :
-- on garde la migration rejouable.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'day_events'
  ) then
    alter publication supabase_realtime add table day_events;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'day_event_logs'
  ) then
    alter publication supabase_realtime add table day_event_logs;
  end if;
end
$$;
