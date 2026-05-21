'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { CalendarX2 } from 'lucide-react';
import { toast } from 'sonner';

import { Header } from '@/components/Header';
import { NamePromptModal } from '@/components/NamePromptModal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { normalizeName, toDateKey } from '@/lib/booking-rules';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/use-current-user';
import type { Booking, Desk } from '@/types/database';

const SLOT_LABEL: Record<Booking['slot'], string> = {
  morning: 'Matin',
  afternoon: 'Apres-midi',
};

interface DayGroup {
  dateKey: string;
  bookings: Booking[];
}

export default function MyBookingsPage() {
  const { userName, setUserName, loaded } = useCurrentUser();

  const [desks, setDesks] = useState<Desk[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [mounted, setMounted] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const todayKey = useMemo(() => toDateKey(new Date()), []);

  useEffect(() => {
    setMounted(true);
  }, []);

  const deskLabels = useMemo(() => {
    const map = new Map<string, string>();
    for (const desk of desks) map.set(desk.id, desk.label);
    return map;
  }, [desks]);

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

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('date', todayKey)
      .order('date')
      .order('slot');
    if (error) {
      toast.error('Impossible de charger tes reservations.');
      return;
    }
    setBookings((data ?? []) as Booking[]);
  }, [todayKey]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('my-bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  // Reservations futures de l'utilisateur courant, groupees par jour.
  const groups = useMemo<DayGroup[]>(() => {
    const mine = bookings.filter(
      (b) => normalizeName(b.user_name) === normalizeName(userName),
    );
    const byDate = new Map<string, Booking[]>();
    for (const booking of mine) {
      const list = byDate.get(booking.date) ?? [];
      list.push(booking);
      byDate.set(booking.date, list);
    }
    return [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, list]) => ({
        dateKey,
        bookings: list.sort((a, b) => a.slot.localeCompare(b.slot)),
      }));
  }, [bookings, userName]);

  const handleCancel = useCallback(async () => {
    if (!toCancel) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', toCancel.id);
      if (error) {
        toast.error("L'annulation a echoue, reessaie.");
      } else {
        toast.success('Reservation annulee.');
      }
      await refresh();
    } finally {
      setSubmitting(false);
      setToCancel(null);
    }
  }, [toCancel, refresh]);

  const needsName = loaded && userName.trim() === '';

  return (
    <div className="min-h-screen">
      <Header userName={userName} onChangeName={() => setNamePromptOpen(true)} />

      <main className="mx-auto max-w-3xl space-y-6 px-4 py-6">
        <div>
          <h2 className="text-xl font-bold">Mes reservations</h2>
          <p className="text-sm text-muted-foreground">
            Reservations a venir au nom de{' '}
            <span className="font-medium text-foreground">
              {userName.trim() || '—'}
            </span>
            .
          </p>
        </div>

        {!mounted ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement...
          </p>
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
            <CalendarX2 className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucune reservation a venir.
            </p>
            <Button asChild size="sm">
              <Link href="/">Reserver une place</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.dateKey} className="overflow-hidden rounded-lg border">
                <div className="border-b bg-muted/50 px-4 py-2 text-sm font-semibold capitalize">
                  {format(parseISO(group.dateKey), 'EEEE d MMMM yyyy', {
                    locale: fr,
                  })}
                </div>
                <ul>
                  {group.bookings.map((booking) => (
                    <li
                      key={booking.id}
                      className="flex items-center justify-between gap-3 border-b px-4 py-3 last:border-0"
                    >
                      <div>
                        <p className="font-medium">
                          {deskLabels.get(booking.desk_id) ?? booking.desk_id}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {SLOT_LABEL[booking.slot]}
                        </p>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setToCancel(booking)}
                      >
                        Annuler
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </main>

      <Dialog
        open={toCancel !== null}
        onOpenChange={(open) => {
          if (!open) setToCancel(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Annuler la reservation</DialogTitle>
            <DialogDescription>
              {toCancel && (
                <>
                  Annuler ta reservation sur{' '}
                  <span className="font-medium text-foreground">
                    {deskLabels.get(toCancel.desk_id) ?? toCancel.desk_id}
                  </span>{' '}
                  ({SLOT_LABEL[toCancel.slot].toLowerCase()}) du{' '}
                  <span className="capitalize">
                    {format(parseISO(toCancel.date), 'EEEE d MMMM', {
                      locale: fr,
                    })}
                  </span>{' '}
                  ?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setToCancel(null)}
              disabled={submitting}
            >
              Retour
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleCancel()}
              disabled={submitting}
            >
              {submitting ? 'Annulation...' : 'Annuler la reservation'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
