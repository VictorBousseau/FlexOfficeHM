-- Historique des reservations
-- Capture chaque insertion et chaque suppression sur `bookings` via un trigger.
-- A executer dans l'editeur SQL Supabase apres 0001_init.sql.

-- ============================================================
-- Table
-- ============================================================

create table if not exists booking_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('booked','cancelled')),
  desk_id text not null,
  date date not null,
  slot text not null check (slot in ('morning','afternoon')),
  user_name text not null,
  event_at timestamptz not null default now()
);

create index if not exists booking_events_at_idx
  on booking_events(event_at desc);

create index if not exists booking_events_desk_date_idx
  on booking_events(desk_id, date);

create index if not exists booking_events_user_idx
  on booking_events(lower(user_name));

-- ============================================================
-- Trigger : enregistre chaque insert/delete sur bookings
-- SECURITY DEFINER permet au trigger de bypasser la RLS pour ecrire
-- dans booking_events, alors que les clients anon n'y ont qu'un acces select.
-- ============================================================

create or replace function log_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into booking_events (event_type, desk_id, date, slot, user_name)
    values ('booked', NEW.desk_id, NEW.date, NEW.slot, NEW.user_name);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into booking_events (event_type, desk_id, date, slot, user_name)
    values ('cancelled', OLD.desk_id, OLD.date, OLD.slot, OLD.user_name);
    return OLD;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_booking_events on bookings;
create trigger trg_booking_events
  after insert or delete on bookings
  for each row execute function log_booking_event();

-- ============================================================
-- Row Level Security : lecture seule via anon
-- ============================================================

alter table booking_events enable row level security;

drop policy if exists booking_events_select_anon on booking_events;
create policy booking_events_select_anon on booking_events
  for select to anon, authenticated using (true);

-- Pas de policy insert/update/delete : seul le trigger peut ecrire
-- (grace a SECURITY DEFINER).

-- ============================================================
-- Realtime
-- ============================================================

alter publication supabase_realtime add table booking_events;

-- ============================================================
-- Backfill : reconstitue un evenement "booked" pour chaque
-- reservation actuellement en base. Idempotent grace au filtre
-- not exists.
-- ============================================================

insert into booking_events (event_type, desk_id, date, slot, user_name, event_at)
select 'booked', b.desk_id, b.date, b.slot, b.user_name, b.created_at
from bookings b
where not exists (
  select 1 from booking_events e
  where e.event_type = 'booked'
    and e.desk_id = b.desk_id
    and e.date = b.date
    and e.slot = b.slot
    and e.user_name = b.user_name
    and e.event_at = b.created_at
);
