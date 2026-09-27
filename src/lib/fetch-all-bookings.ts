// Recuperation integrale des reservations sur une periode.
//
// Supabase plafonne une reponse a 1000 lignes. L'historique complet depasse ce
// volume : on pagine avec `.range()` jusqu'a epuisement plutot que d'afficher
// des statistiques calculees sur des donnees tronquees.

import { supabase } from './supabase';
import type { Booking, Slot } from '@/types/database';

/** Colonnes strictement necessaires aux statistiques. */
const STATS_COLUMNS = 'desk_id, date, slot';

const PAGE_SIZE = 1000;

/** Garde-fou : ~50 000 lignes, bien au-dela du volume attendu. */
const MAX_PAGES = 50;

/** Sous-ensemble de `Booking` renvoye pour les statistiques. */
export type StatsBooking = Pick<Booking, 'desk_id' | 'date' | 'slot'>;

function isStatsBooking(row: unknown): row is StatsBooking {
  if (typeof row !== 'object' || row === null) return false;
  const candidate = row as Record<string, unknown>;
  return (
    typeof candidate.desk_id === 'string' &&
    typeof candidate.date === 'string' &&
    (candidate.slot === 'morning' || candidate.slot === 'afternoon')
  );
}

/**
 * Toutes les reservations dont la date est <= `toKey`, paginees.
 * `fromKey` est optionnel : absent, on remonte jusqu'a la plus ancienne.
 *
 * Lecture seule — aucune ecriture, aucune modification de donnee.
 */
export async function fetchAllBookings(params: {
  fromKey?: string;
  toKey: string;
}): Promise<{ rows: StatsBooking[]; truncated: boolean }> {
  const { fromKey, toKey } = params;
  const rows: StatsBooking[] = [];

  for (let page = 0; page < MAX_PAGES; page += 1) {
    let query = supabase
      .from('bookings')
      .select(STATS_COLUMNS)
      .lte('date', toKey)
      .order('date')
      .order('desk_id')
      .order('slot')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (fromKey) query = query.gte('date', fromKey);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const batch = (data ?? []).filter(isStatsBooking);
    rows.push(...batch);

    // Page incomplete : on a tout recupere.
    if ((data ?? []).length < PAGE_SIZE) {
      return { rows, truncated: false };
    }
  }

  // Plafond atteint : on le signale plutot que de presenter des stats fausses.
  return { rows, truncated: true };
}

/** Date `yyyy-MM-dd` de la plus ancienne reservation, ou `null` si base vide. */
export async function fetchOldestBookingDate(): Promise<string | null> {
  const { data, error } = await supabase
    .from('bookings')
    .select('date')
    .order('date')
    .limit(1);

  if (error) throw new Error(error.message);

  const first: unknown = (data ?? [])[0];
  if (typeof first !== 'object' || first === null) return null;
  const date = (first as Record<string, unknown>).date;
  return typeof date === 'string' ? date : null;
}

/** Complete un enregistrement statistique pour les fonctions pures. */
export function toBooking(row: StatsBooking): Booking {
  return {
    id: `${row.desk_id}-${row.date}-${row.slot}`,
    desk_id: row.desk_id,
    date: row.date,
    slot: row.slot as Slot,
    user_name: '',
    created_at: '',
    room_booking_id: null,
    team_label: null,
  };
}
