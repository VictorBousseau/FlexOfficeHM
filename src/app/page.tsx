'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

import { BookingModal, type BookingMode } from '@/components/BookingModal';
import { FloorPlan } from '@/components/FloorPlan';
import { Header } from '@/components/Header';
import { NamePromptModal } from '@/components/NamePromptModal';
import { OccupantsTable } from '@/components/OccupantsTable';
import { SlotToggle } from '@/components/SlotToggle';
import { WeekDayPicker } from '@/components/WeekDayPicker';
import {
  canBook,
  getDeskBooking,
  getDeskStatus,
  getReservableDates,
  toDateKey,
} from '@/lib/booking-rules';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/use-current-user';
import type { Booking, Desk, Slot } from '@/types/database';

interface ModalState {
  desk: Desk;
  mode: BookingMode;
}

/** Date selectionnee par defaut : aujourd'hui si reservable, sinon le 1er jour de la fenetre. */
function defaultDate(): Date {
  const dates = getReservableDates();
  const todayKey = toDateKey(new Date());
  return dates.find((d) => toDateKey(d) === todayKey) ?? dates[0];
}

export default function HomePage() {
  const { userName, setUserName, loaded } = useCurrentUser();

  const [desks, setDesks] = useState<Desk[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [slot, setSlot] = useState<Slot>('morning');
  const [mounted, setMounted] = useState(false);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);

  // Bornes de la fenetre de reservation (3 semaines).
  const { firstKey, lastKey } = useMemo(() => {
    const dates = getReservableDates();
    return {
      firstKey: toDateKey(dates[0]),
      lastKey: toDateKey(dates[dates.length - 1]),
    };
  }, []);

  // Initialisation cote client (evite tout decalage d'hydratation sur les dates).
  useEffect(() => {
    setSelectedDate(defaultDate());
    setSlot(new Date().getHours() < 13 ? 'morning' : 'afternoon');
    setMounted(true);
  }, []);

  // Chargement des places (une fois).
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

  // Chargement des reservations de la fenetre.
  const refreshBookings = useCallback(async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('*')
      .gte('date', firstKey)
      .lte('date', lastKey);
    if (error) {
      toast.error('Impossible de charger les reservations.');
      return;
    }
    setBookings((data ?? []) as Booking[]);
  }, [firstKey, lastKey]);

  useEffect(() => {
    void refreshBookings();
  }, [refreshBookings]);

  // Realtime : toute modification de bookings declenche un rafraichissement.
  useEffect(() => {
    const channel = supabase
      .channel('bookings-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bookings' },
        () => {
          void refreshBookings();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshBookings]);

  const needsName = loaded && userName.trim() === '';

  const handleDeskClick = useCallback(
    (deskId: string) => {
      const desk = desks.find((d) => d.id === deskId);
      if (!desk) return;
      if (userName.trim() === '') {
        setNamePromptOpen(true);
        return;
      }
      const status = getDeskStatus({
        deskId,
        date: selectedDate,
        slot,
        bookings,
        currentUserName: userName,
      });
      if (status === 'free') {
        setModal({ desk, mode: 'book' });
      } else if (status === 'mine') {
        setModal({ desk, mode: 'cancel' });
      } else {
        const booking = getDeskBooking({
          deskId,
          date: selectedDate,
          slot,
          bookings,
        });
        toast.info(`Place occupee par ${booking?.user_name ?? 'un collegue'}.`);
      }
    },
    [desks, userName, selectedDate, slot, bookings],
  );

  const handleConfirm = useCallback(async () => {
    if (!modal) return;
    setSubmitting(true);
    try {
      if (modal.mode === 'book') {
        const check = canBook({
          userName,
          date: selectedDate,
          slot,
          existingBookings: bookings,
        });
        if (!check.ok) {
          toast.error(check.reason);
          return;
        }
        const { error } = await supabase.from('bookings').insert({
          desk_id: modal.desk.id,
          date: toDateKey(selectedDate),
          slot,
          user_name: userName.trim(),
        });
        if (error) {
          toast.error(
            error.code === '23505'
              ? "Cette place vient d'etre prise par quelqu'un d'autre."
              : 'La reservation a echoue, reessaie.',
          );
        } else {
          toast.success(`${modal.desk.label} reserve.`);
        }
      } else {
        const booking = getDeskBooking({
          deskId: modal.desk.id,
          date: selectedDate,
          slot,
          bookings,
        });
        if (booking) {
          const { error } = await supabase
            .from('bookings')
            .delete()
            .eq('id', booking.id);
          if (error) {
            toast.error("L'annulation a echoue, reessaie.");
          } else {
            toast.success('Reservation annulee.');
          }
        }
      }
      await refreshBookings();
    } finally {
      setSubmitting(false);
      setModal(null);
    }
  }, [modal, userName, selectedDate, slot, bookings, refreshBookings]);

  return (
    <div className="min-h-screen">
      <Header userName={userName} onChangeName={() => setNamePromptOpen(true)} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {mounted ? (
          <>
            <section className="space-y-3">
              <WeekDayPicker
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
              />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-medium capitalize">
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
                </p>
                <SlotToggle slot={slot} onChange={setSlot} />
              </div>
            </section>

            <FloorPlan
              bookings={bookings}
              currentUserName={userName}
              date={selectedDate}
              slot={slot}
              onDeskClick={handleDeskClick}
            />

            <OccupantsTable
              desks={desks}
              bookings={bookings}
              date={selectedDate}
              slot={slot}
              currentUserName={userName}
              onDeskClick={handleDeskClick}
            />
          </>
        ) : (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement...
          </p>
        )}
      </main>

      <BookingModal
        open={modal !== null}
        onOpenChange={(open) => {
          if (!open) setModal(null);
        }}
        desk={modal?.desk ?? null}
        date={selectedDate}
        slot={slot}
        mode={modal?.mode ?? 'book'}
        onConfirm={() => void handleConfirm()}
        submitting={submitting}
      />

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
