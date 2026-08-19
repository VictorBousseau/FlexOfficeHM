'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { getReservableDates, toDateKey } from '@/lib/booking-rules';
import { cn } from '@/lib/utils';
import type { DayEventInsert, Slot } from '@/types/database';

interface EventFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Jour pre-selectionne (celui affiche sur le plan). */
  defaultDate: Date;
  userName: string;
  onSubmit: (payload: DayEventInsert) => void;
  submitting: boolean;
}

/** `''` = journee entiere (stocke `null` en base). */
type SlotChoice = '' | Slot;

const SLOT_CHOICES: { value: SlotChoice; label: string }[] = [
  { value: '', label: 'Journee entiere' },
  { value: 'morning', label: 'Matin' },
  { value: 'afternoon', label: 'Apres-midi' },
];

const EMOJIS = ['🎂', '🍪', '🎉', '📣', '🥐', '🍕', '☕', '🏆'];

const TITLE_MAX = 80;

const FIELD_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

export function EventFormModal({
  open,
  onOpenChange,
  defaultDate,
  userName,
  onSubmit,
  submitting,
}: EventFormModalProps) {
  const dates = useMemo(() => getReservableDates(), []);

  const [dateKey, setDateKey] = useState(() => toDateKey(defaultDate));
  const [slot, setSlot] = useState<SlotChoice>('');
  const [emoji, setEmoji] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  // Reinitialisation a chaque ouverture, sur le jour affiche.
  useEffect(() => {
    if (!open) return;
    setDateKey(toDateKey(defaultDate));
    setSlot('');
    setEmoji(null);
    setTitle('');
    setDescription('');
  }, [open, defaultDate]);

  const canSubmit = title.trim().length > 0 && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      date: dateKey,
      slot: slot === '' ? null : slot,
      emoji,
      title: title.trim(),
      description: description.trim() === '' ? null : description.trim(),
      created_by: userName.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajouter un evenement</DialogTitle>
          <DialogDescription>
            Anniversaire, competition de cookie, pot de depart... Visible par
            toute l&apos;equipe. Ne bloque aucune place.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="event-title" className="text-sm font-medium">
              Titre
            </label>
            <Input
              id="event-title"
              value={title}
              maxLength={TITLE_MAX}
              placeholder="Ex : Anniversaire de Victor"
              disabled={submitting}
              onChange={(event) => setTitle(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submit();
                }
              }}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-sm font-medium">Icone (optionnel)</span>
            <div className="flex flex-wrap gap-1.5">
              {EMOJIS.map((choice) => {
                const active = emoji === choice;
                return (
                  <button
                    key={choice}
                    type="button"
                    aria-pressed={active}
                    disabled={submitting}
                    onClick={() => setEmoji(active ? null : choice)}
                    className={cn(
                      'h-9 w-9 rounded-md border text-lg leading-none transition-colors',
                      active
                        ? 'border-primary bg-accent'
                        : 'hover:bg-accent',
                    )}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="event-date" className="text-sm font-medium">
                Jour
              </label>
              <select
                id="event-date"
                value={dateKey}
                disabled={submitting}
                onChange={(event) => setDateKey(event.target.value)}
                className={cn(FIELD_CLASS, 'capitalize')}
              >
                {dates.map((day) => {
                  const key = toDateKey(day);
                  return (
                    <option key={key} value={key}>
                      {format(day, 'EEEE d MMMM', { locale: fr })}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="event-slot" className="text-sm font-medium">
                Creneau
              </label>
              <select
                id="event-slot"
                value={slot}
                disabled={submitting}
                onChange={(event) =>
                  setSlot(event.target.value as SlotChoice)
                }
                className={FIELD_CLASS}
              >
                {SLOT_CHOICES.map((choice) => (
                  <option key={choice.label} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="event-description" className="text-sm font-medium">
              Details (optionnel)
            </label>
            <textarea
              id="event-description"
              value={description}
              rows={2}
              maxLength={280}
              placeholder="Ex : rendez-vous en cuisine a 15h"
              disabled={submitting}
              onChange={(event) => setDescription(event.target.value)}
              className={cn(FIELD_CLASS, 'h-auto resize-none')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Annuler
          </Button>
          <Button onClick={submit} disabled={!canSubmit}>
            Ajouter
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
