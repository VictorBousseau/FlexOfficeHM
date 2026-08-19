'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

import type { ActionTarget } from '@/components/BookingModal';
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
import type { DeskDay, RoomDay, RoomSlotState } from '@/lib/booking-rules';
import type { Desk, Slot } from '@/types/database';

interface RoomBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Place cliquee dans la salle. */
  desk: Desk | null;
  date: Date;
  /** Etat de la place cliquee. */
  day: DeskDay | null;
  /** Etat de la salle entiere. */
  room: RoomDay | null;
  onSeatAction: (target: ActionTarget, action: 'book' | 'cancel') => void;
  onRoomAction: (
    target: ActionTarget,
    action: 'book' | 'cancel',
    teamLabel: string,
  ) => void;
  submitting: boolean;
}

const SLOT_LABEL: Record<Slot, string> = {
  morning: 'Matin',
  afternoon: 'Apres-midi',
};

const SLOTS: Slot[] = ['morning', 'afternoon'];

const TEAM_LABEL_MAX = 60;

/** Vrai si le creneau est entierement libre (aucune place prise). */
function isRoomFree(state: RoomSlotState): boolean {
  return state.occupied === 0;
}

export function RoomBookingModal({
  open,
  onOpenChange,
  desk,
  date,
  day,
  room,
  onSeatAction,
  onRoomAction,
  submitting,
}: RoomBookingModalProps) {
  const [teamLabel, setTeamLabel] = useState('');

  // Le champ equipe ne doit pas fuir d'une ouverture a l'autre.
  useEffect(() => {
    if (open) setTeamLabel('');
  }, [open]);

  const dateLabel = format(date, 'EEEE d MMMM', { locale: fr });
  const roomName = desk?.bureau_group ?? 'Salle';

  const bothRoomFree = room !== null && SLOTS.every((s) => isRoomFree(room[s]));
  const bothRoomMine =
    room !== null && SLOTS.every((s) => room[s].roomBooking?.mine === true);

  /**
   * Un creneau privatise ne se gere jamais place par place : annuler une
   * seule ligne casserait le lot. On neutralise donc la section "une place".
   */
  const seatLockedReason = (slot: Slot): string | null => {
    const booking = room?.[slot].roomBooking;
    if (!booking) return null;
    if (booking.mine) return 'Incluse dans ta privatisation de la salle';
    const who = booking.teamLabel
      ? `${booking.userName} — ${booking.teamLabel}`
      : booking.userName;
    return `Salle privatisee par ${who}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{roomName}</DialogTitle>
          <DialogDescription className="capitalize">
            {dateLabel}
          </DialogDescription>
        </DialogHeader>

        {room && day && desk && (
          <div className="space-y-5">
            {/* ---------- Salle entiere ---------- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Salle entiere</h4>

              {(bothRoomFree || SLOTS.some((s) => isRoomFree(room[s]))) && (
                <div className="space-y-1">
                  <label
                    htmlFor="team-label"
                    className="text-xs text-muted-foreground"
                  >
                    Equipe / motif (optionnel)
                  </label>
                  <Input
                    id="team-label"
                    value={teamLabel}
                    maxLength={TEAM_LABEL_MAX}
                    placeholder="Ex : Equipe Data, atelier trimestriel..."
                    onChange={(event) => setTeamLabel(event.target.value)}
                    disabled={submitting}
                  />
                </div>
              )}

              {bothRoomFree && (
                <Button
                  className="w-full"
                  disabled={submitting}
                  onClick={() => onRoomAction('day', 'book', teamLabel)}
                >
                  Privatiser la salle pour la journee ({room.morning.total}{' '}
                  places)
                </Button>
              )}
              {bothRoomMine && (
                <Button
                  variant="destructive"
                  className="w-full"
                  disabled={submitting}
                  onClick={() => onRoomAction('day', 'cancel', '')}
                >
                  Liberer la salle pour la journee
                </Button>
              )}

              <div className="divide-y rounded-lg border">
                {SLOTS.map((slot) => {
                  const state = room[slot];
                  const booking = state.roomBooking;
                  return (
                    <div
                      key={slot}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium">
                        {SLOT_LABEL[slot]}
                      </span>

                      {booking?.mine && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={submitting}
                          onClick={() => onRoomAction(slot, 'cancel', '')}
                        >
                          Liberer la salle
                        </Button>
                      )}
                      {booking && !booking.mine && (
                        <span className="text-right text-sm text-muted-foreground">
                          Salle reservee par {booking.userName}
                          {booking.teamLabel ? ` — ${booking.teamLabel}` : ''}
                        </span>
                      )}
                      {!booking && isRoomFree(state) && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={submitting}
                          onClick={() => onRoomAction(slot, 'book', teamLabel)}
                        >
                          Privatiser ({state.total} places)
                        </Button>
                      )}
                      {!booking && !isRoomFree(state) && (
                        <span className="text-sm text-muted-foreground">
                          {state.occupied}/{state.total} places deja prises
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---------- Une place ---------- */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">{desk.label}</h4>
              <div className="divide-y rounded-lg border">
                {SLOTS.map((slot) => {
                  const slotState = day[slot];
                  const locked = seatLockedReason(slot);
                  return (
                    <div
                      key={slot}
                      className="flex items-center justify-between gap-3 px-3 py-2.5"
                    >
                      <span className="text-sm font-medium">
                        {SLOT_LABEL[slot]}
                      </span>

                      {locked !== null ? (
                        <span className="text-right text-sm text-muted-foreground">
                          {locked}
                        </span>
                      ) : (
                        <>
                          {slotState.status === 'free' && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={submitting}
                              onClick={() => onSeatAction(slot, 'book')}
                            >
                              Reserver cette place
                            </Button>
                          )}
                          {slotState.status === 'mine' && (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={submitting}
                              onClick={() => onSeatAction(slot, 'cancel')}
                            >
                              Annuler
                            </Button>
                          )}
                          {slotState.status === 'occupied' && (
                            <span className="text-sm text-muted-foreground">
                              Occupe par {slotState.booking?.user_name}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
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
