import { describe, expect, it } from 'vitest';

import {
  getDailySeries,
  getDayOccupancy,
  getGroupRates,
  getStatsDesks,
  getWeekdayAverages,
} from './occupancy-stats';
import type { Booking, Desk, DeskKind, Slot } from '@/types/database';

// ============================================================
// Jeu d'essai reduit : 2 bureaux individuels (1 et 2 places),
// 1 open space de 2 places, 1 salle de reunion de 2 places.
// Perimetre statistique attendu : 5 places / 3 bureaux.
// ============================================================

function desk(id: string, bureauGroup: string, kind: DeskKind): Desk {
  return {
    id,
    label: id,
    bureau_group: bureauGroup,
    kind,
    display_order: 0,
    has_dual_screen: false,
  };
}

const DESKS: Desk[] = [
  desk('3.06-1', '3.06', 'individual'),
  desk('3.09-1', '3.09', 'individual'),
  desk('3.09-2', '3.09', 'individual'),
  desk('OS6-1', 'OS6', 'openspace'),
  desk('OS6-2', 'OS6', 'openspace'),
  desk('SDR1-1', 'SDR1', 'meeting_room'),
  desk('SDR1-2', 'SDR1', 'meeting_room'),
];

function booking(
  deskId: string,
  date: string,
  slot: Slot,
  user = 'Victor',
): Booking {
  return {
    id: `${deskId}-${date}-${slot}`,
    desk_id: deskId,
    date,
    slot,
    user_name: user,
    created_at: `${date}T08:00:00Z`,
    room_booking_id: null,
    team_label: null,
  };
}

// 2026-09-21 = lundi, 2026-09-22 = mardi, 2026-09-25 = vendredi,
// 2026-09-26 = samedi, 2026-09-28 = lundi suivant.
const MONDAY = new Date(2026, 8, 21);
const TUESDAY = new Date(2026, 8, 22);
const FRIDAY = new Date(2026, 8, 25);
const NEXT_MONDAY = new Date(2026, 8, 28);

describe('getStatsDesks', () => {
  it('exclut les salles de reunion', () => {
    const scope = getStatsDesks(DESKS);
    expect(scope).toHaveLength(5);
    expect(scope.every((d) => d.kind !== 'meeting_room')).toBe(true);
  });
});

describe('getDayOccupancy', () => {
  it('renvoie des totaux derives des places, jour vide', () => {
    const result = getDayOccupancy({ date: MONDAY, desks: DESKS, bookings: [] });
    expect(result).toEqual({
      occupiedSeats: 0,
      totalSeats: 5,
      occupiedDesks: 0,
      totalDesks: 3,
    });
  });

  it('compte 1 bureau et 1 place pour un bureau de 2 places occupe par une seule personne', () => {
    const result = getDayOccupancy({
      date: MONDAY,
      desks: DESKS,
      bookings: [booking('3.09-1', '2026-09-21', 'morning')],
    });
    expect(result.occupiedSeats).toBe(1);
    expect(result.occupiedDesks).toBe(1);
  });

  it('compte 1 place quand matin et apres-midi sont pris par deux personnes differentes', () => {
    const result = getDayOccupancy({
      date: MONDAY,
      desks: DESKS,
      bookings: [
        booking('3.06-1', '2026-09-21', 'morning', 'Alice'),
        booking('3.06-1', '2026-09-21', 'afternoon', 'Bob'),
      ],
    });
    expect(result.occupiedSeats).toBe(1);
    expect(result.occupiedDesks).toBe(1);
  });

  it('ignore totalement les reservations de salle de reunion', () => {
    const result = getDayOccupancy({
      date: MONDAY,
      desks: DESKS,
      bookings: [
        booking('SDR1-1', '2026-09-21', 'morning'),
        booking('SDR1-2', '2026-09-21', 'morning'),
        booking('SDR1-1', '2026-09-21', 'afternoon'),
      ],
    });
    expect(result.occupiedSeats).toBe(0);
    expect(result.occupiedDesks).toBe(0);
  });

  it('ne compte pas les reservations d un autre jour', () => {
    const result = getDayOccupancy({
      date: MONDAY,
      desks: DESKS,
      bookings: [booking('3.06-1', '2026-09-22', 'morning')],
    });
    expect(result.occupiedSeats).toBe(0);
  });
});

describe('getDailySeries', () => {
  it('couvre uniquement les jours ouvres et met les jours vides a 0', () => {
    const series = getDailySeries({
      from: MONDAY,
      to: NEXT_MONDAY,
      desks: DESKS,
      bookings: [booking('OS6-1', '2026-09-22', 'morning')],
    });

    // lundi 21 -> vendredi 25, puis lundi 28 : 6 jours ouvres,
    // samedi et dimanche exclus.
    expect(series.map((p) => p.date)).toEqual([
      '2026-09-21',
      '2026-09-22',
      '2026-09-23',
      '2026-09-24',
      '2026-09-25',
      '2026-09-28',
    ]);

    expect(series[0].seatRate).toBe(0);
    expect(series[1].occupiedSeats).toBe(1);
    expect(series[1].seatRate).toBeCloseTo(1 / 5);
    expect(series[1].deskRate).toBeCloseTo(1 / 3);
  });

  it('renvoie une serie vide si la borne de fin precede la borne de debut', () => {
    expect(
      getDailySeries({
        from: FRIDAY,
        to: MONDAY,
        desks: DESKS,
        bookings: [],
      }),
    ).toEqual([]);
  });
});

describe('getWeekdayAverages', () => {
  it('moyenne par jour de semaine, dans l ordre lundi vers vendredi', () => {
    const series = getDailySeries({
      from: MONDAY,
      to: NEXT_MONDAY,
      desks: DESKS,
      bookings: [
        // lundi 21 : 1 place sur 5
        booking('OS6-1', '2026-09-21', 'morning'),
        // lundi 28 : 3 places sur 5
        booking('OS6-1', '2026-09-28', 'morning'),
        booking('OS6-2', '2026-09-28', 'morning'),
        booking('3.06-1', '2026-09-28', 'afternoon'),
      ],
    });

    const averages = getWeekdayAverages(series);
    expect(averages.map((a) => a.weekday)).toEqual([
      'Lundi',
      'Mardi',
      'Mercredi',
      'Jeudi',
      'Vendredi',
    ]);
    // Moyenne des deux lundis : (1/5 + 3/5) / 2 = 0.4
    expect(averages[0].seatRate).toBeCloseTo(0.4);
    expect(averages[1].seatRate).toBe(0);
  });
});

describe('getGroupRates', () => {
  it('rapporte les demi-journees reservees aux demi-journees disponibles', () => {
    // Une seule journee ouvree : lundi 21.
    const rates = getGroupRates({
      from: MONDAY,
      to: MONDAY,
      desks: DESKS,
      bookings: [
        // 3.09 : 2 places x 2 creneaux = 4 demi-journees possibles, 3 prises
        booking('3.09-1', '2026-09-21', 'morning'),
        booking('3.09-1', '2026-09-21', 'afternoon'),
        booking('3.09-2', '2026-09-21', 'morning'),
        // OS6 : 4 possibles, 1 prise
        booking('OS6-1', '2026-09-21', 'morning'),
        // SDR hors perimetre
        booking('SDR1-1', '2026-09-21', 'morning'),
      ],
    });

    expect(rates.map((r) => r.bureauGroup)).toEqual(['3.09', 'OS6', '3.06']);
    expect(rates[0].rate).toBeCloseTo(3 / 4);
    expect(rates[1].rate).toBeCloseTo(1 / 4);
    expect(rates[2].rate).toBe(0);
    // Aucune ligne pour la salle de reunion.
    expect(rates.some((r) => r.bureauGroup === 'SDR1')).toBe(false);
  });

  it('ignore les reservations hors periode et de week-end', () => {
    const rates = getGroupRates({
      from: MONDAY,
      to: TUESDAY,
      desks: DESKS,
      bookings: [
        booking('3.06-1', '2026-09-26', 'morning'), // samedi
        booking('3.06-1', '2026-09-28', 'morning'), // hors periode
      ],
    });
    expect(rates.every((r) => r.rate === 0)).toBe(true);
  });
});
