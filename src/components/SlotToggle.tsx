'use client';

import { Sun, Sunset } from 'lucide-react';

import type { Slot } from '@/types/database';
import { cn } from '@/lib/utils';

interface SlotToggleProps {
  slot: Slot;
  onChange: (slot: Slot) => void;
}

export function SlotToggle({ slot, onChange }: SlotToggleProps) {
  return (
    <div
      className="inline-flex rounded-md border bg-background p-1"
      role="group"
      aria-label="Choix du creneau"
    >
      <button
        type="button"
        onClick={() => onChange('morning')}
        aria-pressed={slot === 'morning'}
        className={cn(
          'flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors',
          slot === 'morning'
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent',
        )}
      >
        <Sun className="h-4 w-4" />
        Matin
      </button>
      <button
        type="button"
        onClick={() => onChange('afternoon')}
        aria-pressed={slot === 'afternoon'}
        className={cn(
          'flex items-center gap-2 rounded px-4 py-2 text-sm font-medium transition-colors',
          slot === 'afternoon'
            ? 'bg-primary text-primary-foreground'
            : 'hover:bg-accent',
        )}
      >
        <Sunset className="h-4 w-4" />
        Apres-midi
      </button>
    </div>
  );
}
