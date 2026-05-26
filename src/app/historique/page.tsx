'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PlusCircle, Search, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Header } from '@/components/Header';
import { NamePromptModal } from '@/components/NamePromptModal';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/use-current-user';
import { cn } from '@/lib/utils';
import type { BookingEvent, Desk, Slot } from '@/types/database';

const SLOT_LABEL: Record<Slot, string> = {
  morning: 'Matin',
  afternoon: 'Apres-midi',
};

const EVENT_LIMIT = 500;

export default function HistoriquePage() {
  const { userName, setUserName, loaded } = useCurrentUser();

  const [events, setEvents] = useState<BookingEvent[]>([]);
  const [desks, setDesks] = useState<Desk[]>([]);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState('');
  const [namePromptOpen, setNamePromptOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Map deskId -> label pour l'affichage
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
      .from('booking_events')
      .select('*')
      .order('event_at', { ascending: false })
      .limit(EVENT_LIMIT);
    if (error) {
      toast.error("Impossible de charger l'historique.");
      return;
    }
    setEvents((data ?? []) as BookingEvent[]);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const channel = supabase
      .channel('booking-events-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'booking_events' },
        () => {
          void refresh();
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length === 0) return events;
    return events.filter((e) => {
      const label = (deskLabels.get(e.desk_id) ?? e.desk_id).toLowerCase();
      return (
        e.user_name.toLowerCase().includes(q) ||
        e.desk_id.toLowerCase().includes(q) ||
        label.includes(q)
      );
    });
  }, [events, deskLabels, query]);

  const needsName = loaded && userName.trim() === '';

  return (
    <div className="min-h-screen">
      <Header userName={userName} onChangeName={() => setNamePromptOpen(true)} />

      <main className="mx-auto max-w-4xl space-y-5 px-4 py-6">
        <div>
          <h2 className="text-xl font-bold">Historique des reservations</h2>
          <p className="text-sm text-muted-foreground">
            Toutes les reservations et annulations sont journalisees. Utile en
            cas de conflit pour reconstituer la chronologie.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer par prenom, place (ex: Victor, 3.06, OS4.1)..."
            className="flex h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-label="Filtrer l'historique"
          />
        </div>

        {!mounted ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Chargement...
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
            {events.length === 0
              ? 'Aucun evenement enregistre pour le moment.'
              : 'Aucun resultat pour ce filtre.'}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">Quand</th>
                  <th className="px-3 py-2 text-left font-medium">Action</th>
                  <th className="px-3 py-2 text-left font-medium">Place</th>
                  <th className="px-3 py-2 text-left font-medium">
                    Jour / creneau
                  </th>
                  <th className="px-3 py-2 text-left font-medium">Par</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((event) => {
                  const isBooked = event.event_type === 'booked';
                  return (
                    <tr
                      key={event.id}
                      className="border-b last:border-0 align-top"
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {format(parseISO(event.event_at), 'EEE d MMM HH:mm', {
                          locale: fr,
                        })}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
                            isBooked
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800',
                          )}
                        >
                          {isBooked ? (
                            <PlusCircle className="h-3 w-3" />
                          ) : (
                            <XCircle className="h-3 w-3" />
                          )}
                          {isBooked ? 'Reserve' : 'Annule'}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {deskLabels.get(event.desk_id) ?? event.desk_id}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 capitalize">
                        {format(parseISO(event.date), 'EEE d MMM', {
                          locale: fr,
                        })}{' '}
                        ·{' '}
                        <span className="text-muted-foreground">
                          {SLOT_LABEL[event.slot]}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium">{event.user_name}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Limite d&apos;affichage : les {EVENT_LIMIT} evenements les plus
          recents. La colonne &laquo;&nbsp;Par&nbsp;&raquo; designe la personne
          au nom de qui la place etait reservee (annulation faite par cette
          personne via l&apos;interface).
        </p>
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
