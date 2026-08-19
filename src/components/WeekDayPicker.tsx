'use client';

import { useMemo } from 'react';
import { format, isSameDay } from 'date-fns';
import { fr } from 'date-fns/locale';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getReservableDates, toDateKey } from '@/lib/booking-rules';
import { cn } from '@/lib/utils';

interface WeekDayPickerProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  /** Cles `yyyy-MM-dd` des jours portant au moins un evenement d'equipe. */
  eventDates?: Set<string>;
}

const WEEK_LABELS = ['Cette semaine', 'Semaine +1', 'Semaine +2'];

export function WeekDayPicker({
  selectedDate,
  onSelect,
  eventDates,
}: WeekDayPickerProps) {
  const weeks = useMemo(() => {
    const dates = getReservableDates();
    return [dates.slice(0, 5), dates.slice(5, 10), dates.slice(10, 15)];
  }, []);

  const selectedWeek = weeks.findIndex((week) =>
    week.some((d) => isSameDay(d, selectedDate)),
  );
  const activeWeek = selectedWeek === -1 ? 0 : selectedWeek;

  return (
    <Tabs
      value={String(activeWeek)}
      onValueChange={(value) => {
        const week = weeks[Number(value)];
        if (week && !week.some((d) => isSameDay(d, selectedDate))) {
          onSelect(week[0]);
        }
      }}
    >
      <TabsList className="grid w-full grid-cols-3">
        {WEEK_LABELS.map((label, index) => (
          <TabsTrigger key={label} value={String(index)}>
            {label}
          </TabsTrigger>
        ))}
      </TabsList>
      {weeks.map((week, index) => (
        <TabsContent key={WEEK_LABELS[index]} value={String(index)}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {week.map((day) => {
              const active = isSameDay(day, selectedDate);
              const hasEvent = eventDates?.has(toDateKey(day)) ?? false;
              return (
                <button
                  key={format(day, 'yyyy-MM-dd')}
                  type="button"
                  onClick={() => onSelect(day)}
                  aria-pressed={active}
                  className={cn(
                    'flex flex-col items-start rounded-md border px-3 py-2 text-sm transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'hover:bg-accent',
                  )}
                >
                  <span className="font-medium capitalize">
                    {format(day, 'EEEE', { locale: fr })}
                  </span>
                  <span
                    className={cn(
                      'flex items-center gap-1.5 text-xs capitalize',
                      active
                        ? 'text-primary-foreground/80'
                        : 'text-muted-foreground',
                    )}
                  >
                    {format(day, 'd MMM', { locale: fr })}
                    {hasEvent && (
                      <span
                        aria-label="Evenement prevu"
                        title="Evenement prevu"
                        className={cn(
                          'inline-block h-1.5 w-1.5 rounded-full',
                          active ? 'bg-primary-foreground' : 'bg-amber-500',
                        )}
                      />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
