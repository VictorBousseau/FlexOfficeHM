// Logique metier pure — aucune dependance Supabase, entierement testable.

import { addDays, format, isWeekend, startOfWeek } from 'date-fns';
import type { Booking, Desk, Slot } from '@/types/database';

/** Format SQL court d'une date metier. */
export function toDateKey(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

/** Normalise un nom pour le matching (insensible casse + trim). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Jours reservables : du lundi de la semaine courante au vendredi de la
 * semaine N+2, soit 3 semaines x 5 jours ouvres = 15 dates.
 */
export function getReservableDates(today: Date = new Date()): Date[] {
  const monday = startOfWeek(today, { weekStartsOn: 1 });
  const dates: Date[] = [];
  for (let week = 0; week < 3; week += 1) {
    for (let day = 0; day < 5; day += 1) {
      dates.push(addDays(monday, week * 7 + day));
    }
  }
  return dates;
}

/** Vrai si la date tombe dans la fenetre reservable (et n'est pas un week-end). */
export function isReservableDate(date: Date, today: Date = new Date()): boolean {
  if (isWeekend(date)) return false;
  const key = toDateKey(date);
  return getReservableDates(today).some((d) => toDateKey(d) === key);
}

/**
 * Verifie qu'un utilisateur peut reserver sur ce creneau.
 * Regle : une personne ne peut avoir qu'UNE reservation par creneau
 * (matin OU apres-midi) sur l'ensemble des places.
 */
export function canBook(params: {
  userName: string;
  date: Date;
  slot: Slot;
  existingBookings: Booking[];
}): { ok: true } | { ok: false; reason: string } {
  const { userName, date, slot, existingBookings } = params;
  const name = normalizeName(userName);

  if (name.length === 0) {
    return { ok: false, reason: 'Indique ton prenom avant de reserver.' };
  }
  if (isWeekend(date)) {
    return { ok: false, reason: 'Pas de reservation possible le week-end.' };
  }
  // TODO: bloquer jours feries

  const dateKey = toDateKey(date);
  const slotLabel = slot === 'morning' ? 'le matin' : "l'apres-midi";
  const clash = existingBookings.some(
    (b) =>
      b.date === dateKey &&
      b.slot === slot &&
      normalizeName(b.user_name) === name,
  );
  if (clash) {
    return {
      ok: false,
      reason: `Tu as deja une reservation ${slotLabel} ce jour-la. Annule-la d'abord pour en choisir une autre.`,
    };
  }
  return { ok: true };
}

/** Statut d'une place pour un creneau donne, du point de vue de l'utilisateur courant. */
export function getDeskStatus(params: {
  deskId: string;
  date: Date;
  slot: Slot;
  bookings: Booking[];
  currentUserName: string;
}): 'free' | 'mine' | 'occupied' {
  const { deskId, date, slot, bookings, currentUserName } = params;
  const dateKey = toDateKey(date);
  const booking = bookings.find(
    (b) => b.desk_id === deskId && b.date === dateKey && b.slot === slot,
  );
  if (!booking) return 'free';
  return normalizeName(booking.user_name) === normalizeName(currentUserName)
    ? 'mine'
    : 'occupied';
}

/** Reservation occupant une place donnee sur un creneau (ou undefined). */
export function getDeskBooking(params: {
  deskId: string;
  date: Date;
  slot: Slot;
  bookings: Booking[];
}): Booking | undefined {
  const { deskId, date, slot, bookings } = params;
  const dateKey = toDateKey(date);
  return bookings.find(
    (b) => b.desk_id === deskId && b.date === dateKey && b.slot === slot,
  );
}

/** Compteur d'occupation "X / N" pour une zone (bureau_group). */
export function getGroupOccupancy(params: {
  bureauGroup: string;
  date: Date;
  slot: Slot;
  desks: Desk[];
  bookings: Booking[];
}): { occupied: number; total: number } {
  const { bureauGroup, date, slot, desks, bookings } = params;
  const dateKey = toDateKey(date);
  const groupDeskIds = new Set(
    desks.filter((d) => d.bureau_group === bureauGroup).map((d) => d.id),
  );
  const occupied = bookings.filter(
    (b) =>
      groupDeskIds.has(b.desk_id) && b.date === dateKey && b.slot === slot,
  ).length;
  return { occupied, total: groupDeskIds.size };
}
