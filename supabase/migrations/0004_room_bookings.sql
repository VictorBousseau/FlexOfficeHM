-- Reservation d'une salle de reunion entiere.
-- A executer dans l'editeur SQL Supabase apres 0003_dual_screen.sql.
--
-- Principe : une privatisation de salle n'est pas un nouvel objet metier,
-- c'est un LOT de reservations classiques (les 6 places de la salle, meme
-- creneau, meme nom) partageant un `room_booking_id`. On conserve ainsi la
-- contrainte unique `bookings_unique_idx` comme garde-fou anti-collision.
--
-- Migration STRICTEMENT ADDITIVE : deux colonnes nullable sur `bookings`,
-- une sur `booking_events`. Les lignes existantes prennent `null` et ne sont
-- ni modifiees ni supprimees. Le backfill de 0002 n'est PAS rejoue.

-- ============================================================
-- Colonnes
-- ============================================================

alter table bookings
  add column if not exists room_booking_id uuid;

alter table bookings
  add column if not exists team_label text;

create index if not exists bookings_room_idx
  on bookings(room_booking_id);

-- L'historique doit refleter la privatisation.
alter table booking_events
  add column if not exists team_label text;

-- ============================================================
-- Trigger : propage team_label dans l'historique
-- Remplace la fonction de 0002 (le trigger trg_booking_events lui-meme
-- n'est pas recree, il pointe deja sur ce nom de fonction).
-- ============================================================

create or replace function log_booking_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    insert into booking_events (event_type, desk_id, date, slot, user_name, team_label)
    values ('booked', NEW.desk_id, NEW.date, NEW.slot, NEW.user_name, NEW.team_label);
    return NEW;
  elsif TG_OP = 'DELETE' then
    insert into booking_events (event_type, desk_id, date, slot, user_name, team_label)
    values ('cancelled', OLD.desk_id, OLD.date, OLD.slot, OLD.user_name, OLD.team_label);
    return OLD;
  end if;
  return null;
end;
$$;
