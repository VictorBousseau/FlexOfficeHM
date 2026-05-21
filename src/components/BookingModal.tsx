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
import type { Desk, Slot } from '@/types/database';

export type BookingMode = 'book' | 'cancel';

interface BookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  desk: Desk | null;
  date: Date;
  slot: Slot;
  mode: BookingMode;
  onConfirm: () => void;
  submitting: boolean;
}

export function BookingModal({
  open,
  onOpenChange,
  desk,
  date,
  slot,
  mode,
  onConfirm,
  submitting,
}: BookingModalProps) {
  const slotLabel = slot === 'morning' ? 'le matin' : "l'apres-midi";
  const dateLabel = format(date, 'EEEE d MMMM', { locale: fr });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'book' ? 'Confirmer la reservation' : 'Annuler la reservation'}
          </DialogTitle>
          <DialogDescription>
            {desk && mode === 'book' && (
              <>
                Reserver <span className="font-medium text-foreground">{desk.label}</span>{' '}
                <span className="capitalize">{dateLabel}</span> {slotLabel} ?
              </>
            )}
            {desk && mode === 'cancel' && (
              <>
                Annuler ta reservation sur{' '}
                <span className="font-medium text-foreground">{desk.label}</span>{' '}
                <span className="capitalize">{dateLabel}</span> {slotLabel} ?
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Retour
          </Button>
          <Button
            variant={mode === 'cancel' ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={submitting}
          >
            {submitting
              ? 'Enregistrement...'
              : mode === 'book'
                ? 'Reserver'
                : 'Annuler la reservation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
