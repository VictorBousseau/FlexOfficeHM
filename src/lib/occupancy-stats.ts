// Statistiques d'occupation — logique metier pure, aucune dependance Supabase.
//
// Perimetre commun a tous les calculs : les salles de reunion sont EXCLUES
// (SDR1/SDR2 servent aussi de salles de seminaire, leurs privatisations
// fausseraient les taux). Les totaux ne sont jamais codes en dur, ils sont
// derives de la table `desks` filtree.
//
// Base de calcul des compteurs journaliers : la journee entiere. Une place
// est "occupee" un jour donne des qu'elle porte une reservation le matin OU
// l'apres-midi.

import { eachDayOfInterval, getDay, isWeekend, parseISO } from 'date-fns';

import { toDateKey } from './booking-rules';
import type { Booking, Desk } from '@/types/database';

/** Places entrant dans les statistiques (hors salles de reunion). */
export function getStatsDesks(desks: Desk[]): Desk[] {
  return desks.filter((d) => d.kind !== 'meeting_room');
}

/**
 * Compteurs d'une journee.
 *
 * - `occupiedDesks` / `totalDesks` : des BUREAUX (`bureau_group`). Un bureau a
 *   deux places ou un open space compte pour 1, quel que soit le nombre
 *   d'occupants.
 * - `occupiedSeats` / `totalSeats` : des PLACES individuelles.
 */
export function getDayOccupancy(params: {
  date: Date;
  desks: Desk[];
  bookings: Booking[];
}): {
  occupiedDesks: number;
  totalDesks: number;
  occupiedSeats: number;
  totalSeats: number;
} {
  const { date, desks, bookings } = params;
  const scope = buildScope(desks);
  const dateKey = toDateKey(date);
  return countDay(
    scope,
    bookings.filter((b) => b.date === dateKey),
  );
}

/** Point de la serie journaliere. */
export interface DailyPoint {
  /** Cle `yyyy-MM-dd`. */
  date: string;
  seatRate: number;
  deskRate: number;
  occupiedSeats: number;
  occupiedDesks: number;
}

/**
 * Serie jour par jour sur une periode, jours ouvres uniquement.
 * Un jour ouvre sans aucune reservation est present avec un taux de 0 —
 * indispensable pour que les moyennes ne soient pas surevaluees.
 */
export function getDailySeries(params: {
  from: Date;
  to: Date;
  desks: Desk[];
  bookings: Booking[];
}): DailyPoint[] {
  const { from, to, desks, bookings } = params;
  if (from > to) return [];

  const scope = buildScope(desks);
  const byDate = groupByDate(bookings);

  return workdaysBetween(from, to).map((day) => {
    const dateKey = toDateKey(day);
    const counts = countDay(scope, byDate.get(dateKey) ?? []);
    return {
      date: dateKey,
      seatRate: ratio(counts.occupiedSeats, counts.totalSeats),
      deskRate: ratio(counts.occupiedDesks, counts.totalDesks),
      occupiedSeats: counts.occupiedSeats,
      occupiedDesks: counts.occupiedDesks,
    };
  });
}

const WEEKDAY_LABELS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];

/**
 * Taux moyen par jour de la semaine. Seuls les jours reellement presents dans
 * la serie sont renvoyes, dans l'ordre lundi -> vendredi.
 */
export function getWeekdayAverages(
  series: DailyPoint[],
): Array<{ weekday: string; seatRate: number }> {
  const sums = new Map<number, { total: number; count: number }>();

  for (const point of series) {
    // getDay() : 0 = dimanche. On indexe 0 = lundi.
    const index = getDay(parseISO(point.date)) - 1;
    if (index < 0 || index > 4) continue;
    const bucket = sums.get(index) ?? { total: 0, count: 0 };
    bucket.total += point.seatRate;
    bucket.count += 1;
    sums.set(index, bucket);
  }

  return WEEKDAY_LABELS.map((weekday, index) => ({ weekday, index }))
    .filter(({ index }) => sums.has(index))
    .map(({ weekday, index }) => {
      const bucket = sums.get(index);
      return {
        weekday,
        seatRate: bucket ? ratio(bucket.total, bucket.count) : 0,
      };
    });
}

/**
 * Taux d'occupation par zone sur la periode :
 * demi-journees-places reservees / (places du groupe x 2 x jours ouvres).
 * Trie du plus occupe au moins occupe.
 */
export function getGroupRates(params: {
  from: Date;
  to: Date;
  desks: Desk[];
  bookings: Booking[];
}): Array<{ bureauGroup: string; rate: number }> {
  const { from, to, desks, bookings } = params;
  const scope = buildScope(desks);
  const workdays = new Set(workdaysBetween(from, to).map(toDateKey));

  const booked = new Map<string, number>();
  for (const booking of bookings) {
    if (!workdays.has(booking.date)) continue;
    const group = scope.groupOf.get(booking.desk_id);
    if (!group) continue;
    booked.set(group, (booked.get(group) ?? 0) + 1);
  }

  const rates = [...scope.seatsPerGroup].map(([bureauGroup, seats]) => ({
    bureauGroup,
    rate: ratio(booked.get(bureauGroup) ?? 0, seats * 2 * workdays.size),
  }));

  rates.sort((a, b) => b.rate - a.rate || a.bureauGroup.localeCompare(b.bureauGroup));
  return rates;
}

// ============================================================
// Interne
// ============================================================

interface Scope {
  /** desk_id -> bureau_group, restreint aux places statistiques. */
  groupOf: Map<string, string>;
  /** bureau_group -> nombre de places. */
  seatsPerGroup: Map<string, number>;
  totalSeats: number;
  totalDesks: number;
}

function buildScope(desks: Desk[]): Scope {
  const groupOf = new Map<string, string>();
  const seatsPerGroup = new Map<string, number>();

  for (const desk of getStatsDesks(desks)) {
    groupOf.set(desk.id, desk.bureau_group);
    seatsPerGroup.set(
      desk.bureau_group,
      (seatsPerGroup.get(desk.bureau_group) ?? 0) + 1,
    );
  }

  return {
    groupOf,
    seatsPerGroup,
    totalSeats: groupOf.size,
    totalDesks: seatsPerGroup.size,
  };
}

/** Compte les occupants d'une journee deja filtree sur la date. */
function countDay(
  scope: Scope,
  dayBookings: Booking[],
): {
  occupiedDesks: number;
  totalDesks: number;
  occupiedSeats: number;
  totalSeats: number;
} {
  const seats = new Set<string>();
  const groups = new Set<string>();

  for (const booking of dayBookings) {
    const group = scope.groupOf.get(booking.desk_id);
    // Place hors perimetre (salle de reunion) : ignoree.
    if (!group) continue;
    seats.add(booking.desk_id);
    groups.add(group);
  }

  return {
    occupiedSeats: seats.size,
    totalSeats: scope.totalSeats,
    occupiedDesks: groups.size,
    totalDesks: scope.totalDesks,
  };
}

function groupByDate(bookings: Booking[]): Map<string, Booking[]> {
  const map = new Map<string, Booking[]>();
  for (const booking of bookings) {
    const bucket = map.get(booking.date);
    if (bucket) bucket.push(booking);
    else map.set(booking.date, [booking]);
  }
  return map;
}

/** Jours ouvres (lundi -> vendredi) de l'intervalle, bornes incluses. */
// TODO: exclure jours feries
function workdaysBetween(from: Date, to: Date): Date[] {
  if (from > to) return [];
  return eachDayOfInterval({ start: from, end: to }).filter(
    (day) => !isWeekend(day),
  );
}

function ratio(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}
