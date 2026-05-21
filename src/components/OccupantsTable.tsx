'use client';

import { Button } from '@/components/ui/button';
import {
  getDeskBooking,
  getDeskStatus,
  getGroupOccupancy,
} from '@/lib/booking-rules';
import type { Booking, Desk, DeskKind, Slot } from '@/types/database';

interface OccupantsTableProps {
  desks: Desk[];
  bookings: Booking[];
  date: Date;
  slot: Slot;
  currentUserName: string;
  onDeskClick: (deskId: string) => void;
}

const KIND_SECTIONS: { kind: DeskKind; title: string }[] = [
  { kind: 'individual', title: 'Bureaux individuels' },
  { kind: 'openspace', title: 'Open spaces' },
  { kind: 'meeting_room', title: 'Salles de reunion' },
];

/** Liste ordonnee et dedupliquee des bureau_group d'un ensemble de places. */
function orderedGroups(desks: Desk[]): string[] {
  const groups: string[] = [];
  for (const desk of desks) {
    if (!groups.includes(desk.bureau_group)) groups.push(desk.bureau_group);
  }
  return groups;
}

export function OccupantsTable({
  desks,
  bookings,
  date,
  slot,
  currentUserName,
  onDeskClick,
}: OccupantsTableProps) {
  return (
    <div className="space-y-8">
      {KIND_SECTIONS.map((section) => {
        const sectionDesks = desks.filter((d) => d.kind === section.kind);
        if (sectionDesks.length === 0) return null;

        return (
          <section key={section.kind}>
            <h3 className="mb-3 text-lg font-semibold">{section.title}</h3>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {orderedGroups(sectionDesks).map((group) => {
                const groupDesks = sectionDesks.filter(
                  (d) => d.bureau_group === group,
                );
                const occ = getGroupOccupancy({
                  bureauGroup: group,
                  date,
                  slot,
                  desks,
                  bookings,
                });
                const full = occ.occupied === occ.total;

                return (
                  <div key={group} className="overflow-hidden rounded-lg border">
                    <div className="flex items-center justify-between border-b bg-muted/50 px-3 py-2">
                      <span className="font-medium">{group}</span>
                      <span
                        className={
                          full
                            ? 'text-sm font-medium text-destructive'
                            : 'text-sm text-muted-foreground'
                        }
                      >
                        {occ.occupied}/{occ.total} occupe
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <tbody>
                        {groupDesks.map((desk) => {
                          const status = getDeskStatus({
                            deskId: desk.id,
                            date,
                            slot,
                            bookings,
                            currentUserName,
                          });
                          const booking = getDeskBooking({
                            deskId: desk.id,
                            date,
                            slot,
                            bookings,
                          });
                          return (
                            <tr
                              key={desk.id}
                              className="border-b last:border-0"
                            >
                              <td className="px-3 py-2">{desk.label}</td>
                              <td className="px-3 py-2">
                                {booking ? (
                                  <span
                                    className={
                                      status === 'mine'
                                        ? 'font-medium text-blue-700'
                                        : 'text-foreground'
                                    }
                                  >
                                    {booking.user_name}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">
                                    Libre
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-right">
                                {status === 'free' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => onDeskClick(desk.id)}
                                  >
                                    Reserver
                                  </Button>
                                )}
                                {status === 'mine' && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => onDeskClick(desk.id)}
                                  >
                                    Annuler
                                  </Button>
                                )}
                                {status === 'occupied' && (
                                  <span className="text-xs text-muted-foreground">
                                    Occupe
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
