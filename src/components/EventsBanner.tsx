'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { PartyPopper, Plus, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { DayEvent, Slot } from '@/types/database';

interface EventsBannerProps {
  events: DayEvent[];
  date: Date;
  onAdd: () => void;
  onDelete: (eventId: string) => void;
}

const SLOT_LABEL: Record<Slot, string> = {
  morning: 'Matin',
  afternoon: 'Apres-midi',
};

export function EventsBanner({
  events,
  date,
  onAdd,
  onDelete,
}: EventsBannerProps) {
  const dateLabel = format(date, 'EEEE d MMMM', { locale: fr });

  return (
    <section className="rounded-lg border bg-amber-50/60 px-3 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <PartyPopper className="h-4 w-4 text-amber-700" />
          Ce qui se passe <span className="capitalize">{dateLabel}</span>
        </h3>
        <Button size="sm" variant="outline" onClick={onAdd}>
          <Plus className="mr-1 h-4 w-4" />
          Ajouter un evenement
        </Button>
      </div>

      {events.length === 0 ? (
        <p className="mt-1.5 text-sm text-muted-foreground">
          Rien de prevu ce jour-la.
        </p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {events.map((event) => (
            <li
              key={event.id}
              className="flex items-start justify-between gap-3 rounded-md bg-white px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                <p className="font-medium">
                  {event.emoji ? `${event.emoji} ` : ''}
                  {event.title}
                  {event.slot && (
                    <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-900">
                      {SLOT_LABEL[event.slot]}
                    </span>
                  )}
                </p>
                {event.description && (
                  <p className="mt-0.5 text-muted-foreground">
                    {event.description}
                  </p>
                )}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  par {event.created_by}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onDelete(event.id)}
                aria-label={`Supprimer l'evenement ${event.title}`}
                title="Supprimer"
                className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
