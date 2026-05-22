'use client';

import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { DeskDay } from '@/lib/booking-rules';
import type { Desk, Slot } from '@/types/database';

/** Cible d'une action : une demi-journee precise ou la journee entiere. */
export type ActionTarget = Slot | 'day';

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desk: Desk | null;
  date: Date;
  day: DeskDay | null;
  onAction: (target: ActionTarget, action: 'book' | 'cancel') => void;
  submitting: boolean;
}

const SLOT_LABEL: Record<Slot, string> = {
  morning: 'Matin',
  afternoon: 'Apres-midi',
};

export function BookingModal({
  open,
  onOpenChange,
  desk,
  date,
  day,
  onAction,
  submitting,
}: BookingModalProps) {
  const dateLabel = format(date, 'EEEE d MMMM', { locale: fr });
  const bothFree =
    day?.morning.status === 'free' && day?.afternoon.status === 'free';
  const bothMine =
    day?.morning.status === 'mine' && day?.afternoon.status === 'mine';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{desk?.label ?? 'Place'}</DialogTitle>
          <DialogDescription className="capitalize">
            {dateLabel}
          </DialogDescription>
        </DialogHeader>

        {day && (
          <div className="space-y-4">
            {bothFree && (
              <Button
                className="w-full"
                disabled={submitting}
                onClick={() => onAction('day', 'book')}
              >
                Reserver la journee entiere
              </Button>
            )}
            {bothMine && (
              <Button
                variant="destructive"
                className="w-full"
                disabled={submitting}
                onClick={() => onAction('day', 'cancel')}
              >
                Annuler la journee
              </Button>
            )}

            <div className="divide-y rounded-lg border">
              {(['morning', 'afternoon'] as Slot[]).map((slot) => {
                const slotState = day[slot];
                return (
                  <div
                    key={slot}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                  >
                    <span className="text-sm font-medium">
                      {SLOT_LABEL[slot]}
                    </span>
                    {slotState.status === 'free' && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={submitting}
                        onClick={() => onAction(slot, 'book')}
                      >
                        Reserver
                      </Button>
                    )}
                    {slotState.status === 'mine' && (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={submitting}
                        onClick={() => onAction(slot, 'cancel')}
                      >
                        Annuler
                      </Button>
                    )}
                    {slotState.status === 'occupied' && (
                      <span className="text-sm text-muted-foreground">
                        Occupe par {slotState.booking?.user_name}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
