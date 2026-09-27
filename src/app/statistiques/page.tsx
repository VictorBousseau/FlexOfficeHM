'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

import { Header } from '@/components/Header';
import { NamePromptModal } from '@/components/NamePromptModal';
import {
  DailyOccupancyChart,
  GroupRatesChart,
  WeekdayChart,
} from '@/components/OccupancyCharts';
import { Button } from '@/components/ui/button';
import { toDateKey } from '@/lib/booking-rules';
import {
  fetchAllBookings,
  fetchOldestBookingDate,
  toBooking,
} from '@/lib/fetch-all-bookings';
import {
  getDailySeries,
  getGroupRates,
  getStatsDesks,
  getWeekdayAverages,
} from '@/lib/occupancy-stats';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/use-current-user';
import { cn } from '@/lib/utils';
import type { Booking, Desk } from '@/types/database';

type PeriodKey = '1m' | '3m' | '6m' | 'all';

const PERIODS: { key: PeriodKey; label: string; months: number | null }[] = [
  { key: '1m', label: '1 mois', months: 1 },
  { key: '3m', label: '3 mois', months: 3 },
  { key: '6m', label: '6 mois', months: 6 },
  { key: 'all', label: 'Tout', months: null },
];

export default function StatistiquesPage() {
  const { userName, setUserName, loaded } = useCurrentUser();

  const [desks, setDesks] = useState<Desk[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [period, setPeriod] = useState<PeriodKey>('3m');
  const [oldestDate, setOldestDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [truncated, setTruncated] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Places (une fois).
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data, error } = await supabase
        .from('desks')
        .select('*')
        .order('display_order');
      if (!active) return;
      if (error) {
        toast.error('Impossible de charger les places.');
        return;
      }
      setDesks((data ?? []) as Desk[]);
    })();
    return () => {
      active = false;
    };
  }, []);

  // Plus ancienne reservation, pour borner "Tout l'historique".
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const date = await fetchOldestBookingDate();
        if (active) setOldestDate(date);
      } catch {
        if (active) toast.error("Impossible de lire le debut de l'historique.");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /**
   * Bornes de la periode. La fin est toujours aujourd'hui : les jours futurs
   * sont exclus, ce n'est pas encore de l'historique.
   */
  const { from, to } = useMemo(() => {
    const today = new Date();
    const months = PERIODS.find((p) => p.key === period)?.months ?? null;
    if (months !== null) {
      return { from: subMonths(today, months), to: today };
    }
    return {
      from: oldestDate ? parseISO(oldestDate) : subMonths(today, 12),
      to: today,
    };
  }, [period, oldestDate]);

  // Chargement pagine : l'historique complet peut depasser 1000 lignes.
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { rows, truncated: hitCap } = await fetchAllBookings({
        fromKey: toDateKey(from),
        toKey: toDateKey(to),
      });
      setBookings(rows.map(toBooking));
      setTruncated(hitCap);
    } catch {
      toast.error('Impossible de charger les reservations.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // ---------- Calculs ----------

  const series = useMemo(
    () => getDailySeries({ from, to, desks, bookings }),
    [from, to, desks, bookings],
  );
  const weekdays = useMemo(() => getWeekdayAverages(series), [series]);
  const groupRates = useMemo(
    () => getGroupRates({ from, to, desks, bookings }),
    [from, to, desks, bookings],
  );

  const summary = useMemo(() => {
    const workdays = series.length;
    const avgSeat =
      workdays > 0
        ? series.reduce((sum, p) => sum + p.seatRate, 0) / workdays
        : 0;
    const avgDesk =
      workdays > 0
        ? series.reduce((sum, p) => sum + p.deskRate, 0) / workdays
        : 0;
    const busiest = series.reduce<(typeof series)[number] | null>(
      (best, point) =>
        best === null || point.occupiedSeats > best.occupiedSeats
          ? point
          : best,
      null,
    );
    return { workdays, avgSeat, avgDesk, busiest };
  }, [series]);

  const totals = useMemo(() => {
    const scope = getStatsDesks(desks);
    return {
      seats: scope.length,
      groups: new Set(scope.map((d) => d.bureau_group)).size,
    };
  }, [desks]);

  const needsName = loaded && userName.trim() === '';
  const hasData = desks.length > 0 && series.length > 0;

  return (
    <div className="min-h-screen">
      <Header userName={userName} onChangeName={() => setNamePromptOpen(true)} />

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6">
        <div>
          <h2 className="text-xl font-bold">Statistiques d&apos;occupation</h2>
          <p className="text-sm text-muted-foreground">
            Sur {totals.seats || '—'} places reparties en {totals.groups || '—'}{' '}
            bureaux. Les salles de reunion sont exclues de tous les calculs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {PERIODS.map((item) => (
            <Button
              key={item.key}
              size="sm"
              variant={period === item.key ? 'default' : 'outline'}
              aria-pressed={period === item.key}
              onClick={() => setPeriod(item.key)}
            >
              {item.label}
            </Button>
          ))}
          {mounted && (
            <span className="text-xs text-muted-foreground">
              du {format(from, 'd MMM yyyy', { locale: fr })} au{' '}
              {format(to, 'd MMM yyyy', { locale: fr })}
            </span>
          )}
        </div>

        {truncated && (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            Volume inhabituel : toutes les reservations n&apos;ont pas pu etre
            chargees. Les chiffres ci-dessous sont incomplets.
          </p>
        )}

        {!mounted || loading ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement des statistiques...
          </p>
        ) : !hasData ? (
          <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            Aucune donnee sur cette periode.
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Occupation moyenne places"
                value={`${Math.round(summary.avgSeat * 100)} %`}
              />
              <StatTile
                label="Occupation moyenne bureaux"
                value={`${Math.round(summary.avgDesk * 100)} %`}
              />
              <StatTile
                label="Jour le plus rempli"
                value={
                  summary.busiest
                    ? `${summary.busiest.occupiedSeats} places`
                    : '—'
                }
                hint={
                  summary.busiest
                    ? format(parseISO(summary.busiest.date), 'EEEE d MMMM', {
                        locale: fr,
                      })
                    : undefined
                }
              />
              <StatTile
                label="Jours ouvres"
                value={String(summary.workdays)}
              />
            </div>

            <DailyOccupancyChart series={series} />
            <WeekdayChart data={weekdays} />
            <GroupRatesChart data={groupRates} />

            <p className="text-xs text-muted-foreground">
              Une place est comptee occupee des qu&apos;elle porte une
              reservation le matin ou l&apos;apres-midi. Un bureau a deux places
              compte pour un bureau, quel que soit le nombre d&apos;occupants.
              Les jours feries ne sont pas exclus et apparaissent a 0 %.
            </p>
          </>
        )}
      </main>

      <NamePromptModal
        open={needsName || namePromptOpen}
        dismissible={!needsName}
        initialName={userName}
        onOpenChange={setNamePromptOpen}
        onSubmit={(name) => {
          setUserName(name);
          setNamePromptOpen(false);
        }}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-0.5 text-2xl font-bold tabular-nums')}>{value}</p>
      {hint && (
        <p className="text-xs capitalize text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}
