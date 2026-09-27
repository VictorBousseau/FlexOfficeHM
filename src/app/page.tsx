'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

import { BookingModal, type ActionTarget } from '@/components/BookingModal';
import { EventFormModal } from '@/components/EventFormModal';
import { EventsBanner } from '@/components/EventsBanner';
import { FloorPlan } from '@/components/FloorPlan';
import { Header } from '@/components/Header';
import { NamePromptModal } from '@/components/NamePromptModal';
import { OccupantsTable } from '@/components/OccupantsTable';
import { RoomBookingModal } from '@/components/RoomBookingModal';
import { WeekDayPicker } from '@/components/WeekDayPicker';
import {
  canBook,
  canBookRoom,
  getDeskBooking,
  getDeskDay,
  getReservableDates,
  getRoomDay,
  getRoomDesks,
  toDateKey,
} from '@/lib/booking-rules';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/use-current-user';
import type {
  Booking,
  DayEvent,
  DayEventInsert,
  Desk,
  Slot,
} from '@/types/database';

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
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [mounted, setMounted] = useState(false);

  const [modalDesk, setModalDesk] = useState<Desk | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [namePromptOpen, setNamePromptOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [eventSubmitting, setEventSubmitting] = useState(false);

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

  // Evenements d'equipe de la fenetre (memes bornes que les reservations).
  const refreshDayEvents = useCallback(async () => {
    const { data, error } = await supabase
      .from('day_events')
      .select('*')
      .gte('date', firstKey)
      .lte('date', lastKey)
      .order('created_at');
    if (error) {
      toast.error('Impossible de charger les evenements.');
      return;
    }
    setDayEvents((data ?? []) as DayEvent[]);
  }, [firstKey, lastKey]);

  useEffect(() => {
    void refreshDayEvents();
  }, [refreshDayEvents]);

  useEffect(() => {
    const channel = supabase
      .channel('day-events-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'day_events' },
        () => {
          void refreshDayEvents();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refreshDayEvents]);

  const needsName = loaded && userName.trim() === '';

  const handleDeskClick = useCallback(
    (deskId: string) => {
      const desk = desks.find((d) => d.id === deskId);
      if (!desk) return;
      if (userName.trim() === '') {
        setNamePromptOpen(true);
        return;
      }
      setModalDesk(desk);
    },
    [desks, userName],
  );

  // Etat journee de la place affichee dans la modale.
  const modalDay = useMemo(() => {
    if (!modalDesk) return null;
    return getDeskDay({
      deskId: modalDesk.id,
      date: selectedDate,
      bookings,
      currentUserName: userName,
    });
  }, [modalDesk, selectedDate, bookings, userName]);

  // Les salles de reunion ouvrent une modale dediee (place OU salle entiere).
  const isMeetingRoom = modalDesk?.kind === 'meeting_room';

  const modalRoom = useMemo(() => {
    if (!modalDesk || modalDesk.kind !== 'meeting_room') return null;
    return getRoomDay({
      bureauGroup: modalDesk.bureau_group,
      date: selectedDate,
      desks,
      bookings,
      currentUserName: userName,
    });
  }, [modalDesk, selectedDate, desks, bookings, userName]);

  const handleAction = useCallback(
    async (target: ActionTarget, action: 'book' | 'cancel') => {
      if (!modalDesk) return;
      const deskId = modalDesk.id;
      const slots: Slot[] =
        target === 'day' ? ['morning', 'afternoon'] : [target];

      setSubmitting(true);
      try {
        if (action === 'book') {
          for (const slot of slots) {
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
          }
          const rows = slots.map((slot) => ({
            desk_id: deskId,
            date: toDateKey(selectedDate),
            slot,
            user_name: userName.trim(),
          }));
          const { error } = await supabase.from('bookings').insert(rows);
          if (error) {
            toast.error(
              error.code === '23505'
                ? "Cette place vient d'etre prise par quelqu'un d'autre."
                : 'La reservation a echoue, reessaie.',
            );
          } else {
            toast.success(
              target === 'day'
                ? `${modalDesk.label} reserve pour la journee.`
                : `${modalDesk.label} reserve.`,
            );
          }
        } else {
          const ids = slots
            .map(
              (slot) =>
                getDeskBooking({ deskId, date: selectedDate, slot, bookings })
                  ?.id,
            )
            .filter((id): id is string => Boolean(id));
          if (ids.length > 0) {
            const { error } = await supabase
              .from('bookings')
              .delete()
              .in('id', ids);
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
        setModalDesk(null);
      }
    },
    [modalDesk, userName, selectedDate, bookings, refreshBookings],
  );

  /**
   * Privatisation d'une salle : un lot = toutes les places de la salle sur un
   * creneau, partageant un meme `room_booking_id`.
   */
  const handleRoomAction = useCallback(
    async (
      target: ActionTarget,
      action: 'book' | 'cancel',
      teamLabel: string,
    ) => {
      if (!modalDesk) return;
      const bureauGroup = modalDesk.bureau_group;
      const roomDesks = getRoomDesks({ bureauGroup, desks });
      const slots: Slot[] =
        target === 'day' ? ['morning', 'afternoon'] : [target];

      setSubmitting(true);
      try {
        if (action === 'book') {
          for (const slot of slots) {
            const check = canBookRoom({
              userName,
              date: selectedDate,
              slot,
              roomDesks,
              existingBookings: bookings,
            });
            if (!check.ok) {
              toast.error(check.reason);
              return;
            }
          }
          const trimmedTeam = teamLabel.trim();
          // Un lot distinct par creneau : chaque demi-journee se libere seule.
          const rows = slots.flatMap((slot) => {
            const roomBookingId = crypto.randomUUID();
            return roomDesks.map((deskOfRoom) => ({
              desk_id: deskOfRoom.id,
              date: toDateKey(selectedDate),
              slot,
              user_name: userName.trim(),
              room_booking_id: roomBookingId,
              team_label: trimmedTeam.length > 0 ? trimmedTeam : null,
            }));
          });
          const { error } = await supabase.from('bookings').insert(rows);
          if (error) {
            toast.error(
              error.code === '23505'
                ? "Une place de cette salle vient d'etre prise, la salle n'est plus libre."
                : 'La privatisation a echoue, reessaie.',
            );
          } else {
            toast.success(
              target === 'day'
                ? `${bureauGroup} privatisee pour la journee.`
                : `${bureauGroup} privatisee.`,
            );
          }
        } else {
          const roomDay = getRoomDay({
            bureauGroup,
            date: selectedDate,
            desks,
            bookings,
            currentUserName: userName,
          });
          const lotIds = slots
            .map((slot) => roomDay[slot].roomBooking?.roomBookingId)
            .filter((id): id is string => Boolean(id));
          if (lotIds.length > 0) {
            const { error } = await supabase
              .from('bookings')
              .delete()
              .in('room_booking_id', lotIds);
            if (error) {
              toast.error("La liberation de la salle a echoue, reessaie.");
            } else {
              toast.success('Salle liberee.');
            }
          }
        }
        await refreshBookings();
      } finally {
        setSubmitting(false);
        setModalDesk(null);
      }
    },
    [modalDesk, desks, userName, selectedDate, bookings, refreshBookings],
  );

  // ---------- Evenements d'equipe ----------

  const handleOpenEventForm = useCallback(() => {
    if (userName.trim() === '') {
      setNamePromptOpen(true);
      return;
    }
    setEventFormOpen(true);
  }, [userName]);

  const handleCreateEvent = useCallback(
    async (payload: DayEventInsert) => {
      setEventSubmitting(true);
      try {
        const { error } = await supabase.from('day_events').insert(payload);
        if (error) {
          toast.error("La creation de l'evenement a echoue, reessaie.");
          return;
        }
        toast.success('Evenement ajoute.');
        setEventFormOpen(false);
        await refreshDayEvents();
      } finally {
        setEventSubmitting(false);
      }
    },
    [refreshDayEvents],
  );

  const handleDeleteEvent = useCallback(
    async (eventId: string) => {
      const { error } = await supabase
        .from('day_events')
        .delete()
        .eq('id', eventId);
      if (error) {
        toast.error("La suppression de l'evenement a echoue, reessaie.");
        return;
      }
      toast.success('Evenement supprime.');
      await refreshDayEvents();
    },
    [refreshDayEvents],
  );

  const selectedDayEvents = useMemo(() => {
    const key = toDateKey(selectedDate);
    return dayEvents.filter((e) => e.date === key);
  }, [dayEvents, selectedDate]);

  const eventDates = useMemo(
    () => new Set(dayEvents.map((e) => e.date)),
    [dayEvents],
  );

  return (
    <div className="min-h-screen">
      <Header userName={userName} onChangeName={() => setNamePromptOpen(true)} />

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {mounted ? (
          <>
            <section className="space-y-2">
              <WeekDayPicker
                selectedDate={selectedDate}
                onSelect={setSelectedDate}
                eventDates={eventDates}
                desks={desks}
                bookings={bookings}
              />
              <p className="text-sm font-medium capitalize">
                {format(selectedDate, 'EEEE d MMMM yyyy', { locale: fr })}
              </p>
              <p className="text-sm text-muted-foreground">
                Clique une place du plan pour reserver la journee entiere ou
                une demi-journee.
              </p>
            </section>

            <EventsBanner
              events={selectedDayEvents}
              date={selectedDate}
              onAdd={handleOpenEventForm}
              onDelete={(id) => void handleDeleteEvent(id)}
            />

            <FloorPlan
              desks={desks}
              bookings={bookings}
              currentUserName={userName}
              date={selectedDate}
              onDeskClick={handleDeskClick}
            />

            <OccupantsTable
              desks={desks}
              bookings={bookings}
              date={selectedDate}
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
        open={modalDesk !== null && !isMeetingRoom}
        onOpenChange={(open) => {
          if (!open) setModalDesk(null);
        }}
        desk={modalDesk}
        date={selectedDate}
        day={modalDay}
        onAction={(target, action) => void handleAction(target, action)}
        submitting={submitting}
      />

      <RoomBookingModal
        open={modalDesk !== null && isMeetingRoom}
        onOpenChange={(open) => {
          if (!open) setModalDesk(null);
        }}
        desk={modalDesk}
        date={selectedDate}
        day={modalDay}
        room={modalRoom}
        onSeatAction={(target, action) => void handleAction(target, action)}
        onRoomAction={(target, action, teamLabel) =>
          void handleRoomAction(target, action, teamLabel)
        }
        submitting={submitting}
      />

      <EventFormModal
        open={eventFormOpen}
        onOpenChange={setEventFormOpen}
        defaultDate={selectedDate}
        userName={userName}
        onSubmit={(payload) => void handleCreateEvent(payload)}
        submitting={eventSubmitting}
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
