import { describe, expect, it } from 'vitest';

import {
  canBook,
  getReservableDates,
  groupByWeek,
  isReservableDate,
  toDateKey,
} from './booking-rules';
import type { Booking, Slot } from '@/types/database';

// ============================================================
// Reperes : semaine du lundi 16 novembre 2026.
//   lun 16, mar 17, mer 18, jeu 19, ven 20, sam 21, dim 22
//   semaine suivante : lun 23 ... ven 27
//   semaine +2       : lun 30 nov ... ven 4 dec
// `new Date(annee, moisZeroBased, jour, h, min)` = heure locale, comme
// l'application.
// ============================================================

const keys = (dates: Date[]) => dates.map(toDateKey);

describe('getReservableDates — borne de fin (ouverture a 9h30)', () => {
  it('le lundi avant 9h30, la semaine +2 n est pas encore ouverte : 10 jours', () => {
    const dates = getReservableDates(new Date(2026, 10, 16, 9, 29));
    expect(keys(dates)).toEqual([
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-23',
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
    ]);
  });

  it('le lundi a 9h30 pile, la semaine +2 s ouvre : 15 jours', () => {
    const dates = getReservableDates(new Date(2026, 10, 16, 9, 30));
    expect(dates).toHaveLength(15);
    expect(keys(dates)[0]).toBe('2026-11-16');
    expect(keys(dates)[14]).toBe('2026-12-04');
  });

  it('a minuit pile le lundi, on est encore sur 10 jours', () => {
    const dates = getReservableDates(new Date(2026, 10, 16, 0, 0));
    expect(dates).toHaveLength(10);
    expect(keys(dates).at(-1)).toBe('2026-11-27');
  });

  it('la borne de fin ne bouge plus pendant le reste de la semaine', () => {
    for (const day of [17, 18, 19, 20]) {
      const dates = getReservableDates(new Date(2026, 10, day, 8, 0));
      expect(keys(dates).at(-1)).toBe('2026-12-04');
    }
  });
});

describe('getReservableDates — borne de debut (les jours passes disparaissent)', () => {
  it('le mardi, le lundi a disparu et le premier groupe fait 4 jours', () => {
    const dates = getReservableDates(new Date(2026, 10, 17, 14, 0));
    expect(keys(dates)[0]).toBe('2026-11-17');
    expect(keys(dates)).not.toContain('2026-11-16');
    expect(dates).toHaveLength(14);
  });

  it('le vendredi, il ne reste qu un jour dans la semaine courante', () => {
    const dates = getReservableDates(new Date(2026, 10, 20, 14, 0));
    expect(keys(dates)[0]).toBe('2026-11-20');
    expect(dates).toHaveLength(11);
  });

  it('aujourd hui est toujours inclus, meme en fin de journee', () => {
    const dates = getReservableDates(new Date(2026, 10, 18, 23, 59));
    expect(keys(dates)[0]).toBe('2026-11-18');
  });

  it('le week-end, la semaine courante est epuisee : 10 jours des le lundi suivant', () => {
    for (const day of [21, 22]) {
      const dates = getReservableDates(new Date(2026, 10, day, 12, 0));
      expect(keys(dates)[0]).toBe('2026-11-23');
      expect(keys(dates).at(-1)).toBe('2026-12-04');
      expect(dates).toHaveLength(10);
    }
  });

  it('ne renvoie jamais de week-end', () => {
    const dates = getReservableDates(new Date(2026, 10, 16, 10, 0));
    expect(dates.every((d) => d.getDay() !== 0 && d.getDay() !== 6)).toBe(true);
  });
});

describe('groupByWeek', () => {
  it('le lundi apres 9h30 : 3 groupes de 5 jours, libelles dans l ordre', () => {
    const now = new Date(2026, 10, 16, 10, 0);
    const groups = groupByWeek(getReservableDates(now), now);
    expect(groups.map((g) => [g.label, g.days.length])).toEqual([
      ['Cette semaine', 5],
      ['Semaine prochaine', 5],
      ['Semaine +2', 5],
    ]);
    expect(groups.map((g) => g.offset)).toEqual([0, 1, 2]);
  });

  it('le jeudi : la semaine courante est reduite a 2 jours', () => {
    const now = new Date(2026, 10, 19, 8, 0);
    const groups = groupByWeek(getReservableDates(now), now);
    expect(groups[0].label).toBe('Cette semaine');
    expect(keys(groups[0].days)).toEqual(['2026-11-19', '2026-11-20']);
    expect(groups[1].days).toHaveLength(5);
  });

  it('le samedi : pas de groupe « Cette semaine », on commence a la suivante', () => {
    const now = new Date(2026, 10, 21, 12, 0);
    const groups = groupByWeek(getReservableDates(now), now);
    expect(groups.map((g) => g.label)).toEqual([
      'Semaine prochaine',
      'Semaine +2',
    ]);
    expect(groups.map((g) => g.offset)).toEqual([1, 2]);
  });

  it('le lundi avant 9h30 : 2 groupes, le premier est bien la semaine courante', () => {
    const now = new Date(2026, 10, 16, 8, 0);
    const groups = groupByWeek(getReservableDates(now), now);
    expect(groups.map((g) => g.label)).toEqual([
      'Cette semaine',
      'Semaine prochaine',
    ]);
  });

  it('ne perd aucune date', () => {
    const now = new Date(2026, 10, 17, 11, 0);
    const dates = getReservableDates(now);
    const grouped = groupByWeek(dates, now).flatMap((g) => g.days);
    expect(keys(grouped)).toEqual(keys(dates));
  });
});

describe('isReservableDate', () => {
  const now = new Date(2026, 10, 17, 10, 0); // mardi 17

  it('refuse un jour ecoule', () => {
    expect(isReservableDate(new Date(2026, 10, 16), now)).toBe(false);
  });

  it('accepte aujourd hui et un jour de la fenetre', () => {
    expect(isReservableDate(new Date(2026, 10, 17), now)).toBe(true);
    expect(isReservableDate(new Date(2026, 11, 4), now)).toBe(true);
  });

  it('refuse au-dela de la fenetre et le week-end', () => {
    expect(isReservableDate(new Date(2026, 11, 7), now)).toBe(false);
    expect(isReservableDate(new Date(2026, 10, 21), now)).toBe(false);
  });
});

describe('canBook — garde-fou de fenetre', () => {
  const now = new Date(2026, 10, 17, 10, 0); // mardi 17
  const base = { userName: 'Victor', slot: 'morning' as Slot, existingBookings: [] as Booking[] };

  it('autorise un jour de la fenetre', () => {
    expect(canBook({ ...base, date: new Date(2026, 10, 18), now }).ok).toBe(true);
  });

  it('refuse un jour desormais ecoule (onglet laisse ouvert)', () => {
    const result = canBook({ ...base, date: new Date(2026, 10, 16), now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('Rafraichis');
  });

  it('refuse un jour au-dela de la fenetre', () => {
    expect(canBook({ ...base, date: new Date(2026, 11, 7), now }).ok).toBe(false);
  });

  it('conserve le message specifique du week-end', () => {
    const result = canBook({ ...base, date: new Date(2026, 10, 21), now });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('week-end');
  });

  it('conserve la regle d une seule reservation par creneau', () => {
    const existing: Booking[] = [
      {
        id: '1',
        desk_id: '3.06-1',
        date: '2026-11-18',
        slot: 'morning',
        user_name: 'victor',
        created_at: '',
        room_booking_id: null,
        team_label: null,
      },
    ];
    const result = canBook({
      ...base,
      date: new Date(2026, 10, 18),
      existingBookings: existing,
      now,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain('deja une reservation');
  });
});
