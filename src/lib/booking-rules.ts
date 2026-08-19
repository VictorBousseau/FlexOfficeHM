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

/** Etat d'une demi-journee pour une place. */
export interface SlotState {
  status: 'free' | 'mine' | 'occupied';
  booking?: Booking;
}

/** Etat d'une place sur la journee complete (matin + apres-midi). */
export interface DeskDay {
  morning: SlotState;
  afternoon: SlotState;
}

/** Calcule l'etat matin + apres-midi d'une place pour une date donnee. */
export function getDeskDay(params: {
  deskId: string;
  date: Date;
  bookings: Booking[];
  currentUserName: string;
}): DeskDay {
  const { deskId, date, bookings, currentUserName } = params;
  const me = normalizeName(currentUserName);
  const build = (slot: Slot): SlotState => {
    const booking = getDeskBooking({ deskId, date, slot, bookings });
    if (!booking) return { status: 'free' };
    const mine = normalizeName(booking.user_name) === me;
    return { status: mine ? 'mine' : 'occupied', booking };
  };
  return { morning: build('morning'), afternoon: build('afternoon') };
}

// ============================================================
// Privatisation d'une salle de reunion
//
// Une salle privatisee n'est pas un objet metier distinct : c'est un LOT de
// reservations classiques (toutes les places de la salle, meme creneau, meme
// nom) partageant un `room_booking_id`. La contrainte unique SQL reste donc
// le garde-fou anti-collision.
// ============================================================

/** Privatisation en cours sur un creneau. */
export interface RoomBookingInfo {
  roomBookingId: string;
  userName: string;
  teamLabel: string | null;
  mine: boolean;
}

/** Etat d'une salle sur un creneau. */
export interface RoomSlotState {
  total: number;
  occupied: number;
  /** Renseigne uniquement si TOUTES les places forment un meme lot. */
  roomBooking?: RoomBookingInfo;
}

/** Etat d'une salle sur la journee complete. */
export interface RoomDay {
  morning: RoomSlotState;
  afternoon: RoomSlotState;
}

/** Places d'une salle, dans l'ordre d'affichage. */
export function getRoomDesks(params: {
  bureauGroup: string;
  desks: Desk[];
}): Desk[] {
  const { bureauGroup, desks } = params;
  return desks.filter((d) => d.bureau_group === bureauGroup);
}

/** Etat matin + apres-midi d'une salle pour une date donnee. */
export function getRoomDay(params: {
  bureauGroup: string;
  date: Date;
  desks: Desk[];
  bookings: Booking[];
  currentUserName: string;
}): RoomDay {
  const { bureauGroup, date, desks, bookings, currentUserName } = params;
  const dateKey = toDateKey(date);
  const me = normalizeName(currentUserName);
  const roomDesks = getRoomDesks({ bureauGroup, desks });
  const roomDeskIds = new Set(roomDesks.map((d) => d.id));

  const build = (slot: Slot): RoomSlotState => {
    const slotBookings = bookings.filter(
      (b) => roomDeskIds.has(b.desk_id) && b.date === dateKey && b.slot === slot,
    );
    const state: RoomSlotState = {
      total: roomDesks.length,
      occupied: slotBookings.length,
    };

    // Privatisation = toutes les places prises, sur un seul et meme lot.
    const lot = slotBookings[0]?.room_booking_id ?? null;
    const isRoom =
      roomDesks.length > 0 &&
      slotBookings.length === roomDesks.length &&
      lot !== null &&
      slotBookings.every((b) => b.room_booking_id === lot);

    if (isRoom && lot) {
      const first = slotBookings[0];
      state.roomBooking = {
        roomBookingId: lot,
        userName: first.user_name,
        teamLabel: first.team_label ?? null,
        mine: normalizeName(first.user_name) === me,
      };
    }
    return state;
  };

  return { morning: build('morning'), afternoon: build('afternoon') };
}

/**
 * Verifie qu'un utilisateur peut privatiser une salle sur ce creneau.
 * Reprend les controles de `canBook` — une privatisation consomme le creneau
 * de la personne au meme titre qu'une place — puis exige que toutes les
 * places de la salle soient libres.
 */
export function canBookRoom(params: {
  userName: string;
  date: Date;
  slot: Slot;
  roomDesks: Desk[];
  existingBookings: Booking[];
}): { ok: true } | { ok: false; reason: string } {
  const { userName, date, slot, roomDesks, existingBookings } = params;

  const base = canBook({ userName, date, slot, existingBookings });
  if (!base.ok) return base;

  if (roomDesks.length === 0) {
    return { ok: false, reason: 'Salle introuvable.' };
  }

  const dateKey = toDateKey(date);
  const roomDeskIds = new Set(roomDesks.map((d) => d.id));
  const taken = existingBookings.filter(
    (b) => roomDeskIds.has(b.desk_id) && b.date === dateKey && b.slot === slot,
  ).length;

  if (taken > 0) {
    const slotLabel = slot === 'morning' ? 'le matin' : "l'apres-midi";
    return {
      ok: false,
      reason: `${taken} place(s) de cette salle sont deja prises ${slotLabel}. Impossible de reserver la salle entiere.`,
    };
  }
  return { ok: true };
}

/** Lignes de reservation composant une privatisation. */
export function getRoomBookingRows(params: {
  roomBookingId: string;
  bookings: Booking[];
}): Booking[] {
  const { roomBookingId, bookings } = params;
  return bookings.filter((b) => b.room_booking_id === roomBookingId);
}

/**
 * Vrai si la place est couverte par une privatisation sur l'un des creneaux.
 * `Boolean(...)` et non `!== null` : la colonne peut etre absente de la
 * reponse (migration 0004 pas encore jouee), auquel cas la valeur est
 * `undefined` et ne doit pas etre lue comme une privatisation.
 */
export function isRoomBookedTile(params: {
  deskId: string;
  date: Date;
  bookings: Booking[];
}): boolean {
  const { deskId, date, bookings } = params;
  const dateKey = toDateKey(date);
  return bookings.some(
    (b) =>
      b.desk_id === deskId &&
      b.date === dateKey &&
      Boolean(b.room_booking_id),
  );
}
