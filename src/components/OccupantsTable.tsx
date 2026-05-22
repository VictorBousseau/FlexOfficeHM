'use client';

import { Button } from '@/components/ui/button';
import {
  getDeskDay,
  getGroupOccupancy,
  type SlotState,
} from '@/lib/booking-rules';
import type { Booking, Desk, DeskKind } from '@/types/database';

interface OccupantsTableProps {
  desks: Desk[];
  bookings: Booking[];
  date: Date;
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

function SlotCell({ state }: { state: SlotState }) {
  if (!state.booking) {
    return <span className="text-muted-foreground">Libre</span>;
  }
  return (
    <span className={state.status === 'mine' ? 'font-medium text-blue-700' : ''}>
      {state.booking.user_name}
    </span>
  );
}

export function OccupantsTable({
  desks,
  bookings,
  date,
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
            <div className="grid gap-4 lg:grid-cols-2">
              {orderedGroups(sectionDesks).map((group) => {
                const groupDesks = sectionDesks.filter(
                  (d) => d.bureau_group === group,
                );
                const occM = getGroupOccupancy({
                  bureauGroup: group,
                  date,
                  slot: 'morning',
                  desks,
                  bookings,
                });
                const occA = getGroupOccupancy({
                  bureauGroup: group,
                  date,
                  slot: 'afternoon',
                  desks,
                  bookings,
                });

                return (
                  <div key={group} className="overflow-hidden rounded-lg border">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/50 px-3 py-2">
                      <span className="font-medium">{group}</span>
                      <span className="text-xs text-muted-foreground">
                        Matin {occM.occupied}/{occM.total} · Apres-midi{' '}
                        {occA.occupied}/{occA.total}
                      </span>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-xs text-muted-foreground">
                          <th className="px-3 py-1.5 text-left font-medium">
                            Place
                          </th>
                          <th className="px-3 py-1.5 text-left font-medium">
                            Matin
                          </th>
                          <th className="px-3 py-1.5 text-left font-medium">
                            Apres-midi
                          </th>
                          <th className="px-3 py-1.5" />
                        </tr>
                      </thead>
                      <tbody>
                        {groupDesks.map((desk) => {
                          const day = getDeskDay({
                            deskId: desk.id,
                            date,
                            bookings,
                            currentUserName,
                          });
                          return (
                            <tr
                              key={desk.id}
                              className="border-b last:border-0"
                            >
                              <td className="px-3 py-2">{desk.label}</td>
                              <td className="px-3 py-2">
                                <SlotCell state={day.morning} />
                              </td>
                              <td className="px-3 py-2">
                                <SlotCell state={day.afternoon} />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => onDeskClick(desk.id)}
                                >
                                  Gerer
                                </Button>
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
