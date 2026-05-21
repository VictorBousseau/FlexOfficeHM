'use client';

import { useEffect, useRef, useState } from 'react';

import { getDeskBooking, getDeskStatus } from '@/lib/booking-rules';
import type { Booking, Slot } from '@/types/database';

interface FloorPlanProps {
  bookings: Booking[];
  currentUserName: string;
  date: Date;
  slot: Slot;
  onDeskClick: (deskId: string) => void;
}

type DeskStatus = 'free' | 'mine' | 'occupied';

const FILL: Record<DeskStatus, string> = {
  free: '#bbf7d0',
  mine: '#bfdbfe',
  occupied: '#fecaca',
};

const STROKE: Record<DeskStatus, string> = {
  free: '#16a34a',
  mine: '#2563eb',
  occupied: '#dc2626',
};

export function FloorPlan({
  bookings,
  currentUserName,
  date,
  slot,
  onDeskClick,
}: FloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  // La callback peut changer d'identite a chaque rendu : on la garde dans un
  // ref pour que le listener delegue (attache une seule fois) reste a jour.
  const onDeskClickRef = useRef(onDeskClick);
  onDeskClickRef.current = onDeskClick;

  // 1. Recuperation et injection du SVG (une seule fois).
  useEffect(() => {
    let cancelled = false;
    fetch('/floor-plan.svg')
      .then((response) => {
        if (!response.ok) throw new Error('SVG introuvable');
        return response.text();
      })
      .then((text) => {
        if (cancelled || !containerRef.current) return;
        const start = text.indexOf('<svg');
        containerRef.current.innerHTML =
          start >= 0 ? text.slice(start) : text;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '100%');
          svg.removeAttribute('height');
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svg.style.height = 'auto';
          svg.style.display = 'block';
        }
        setState('ready');
      })
      .catch(() => {
        if (!cancelled) setState('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // 2. Listeners delegues (clic + clavier), attaches une fois le SVG pret.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || state !== 'ready') return;

    const deskFromEvent = (target: EventTarget | null): string | null => {
      if (!(target instanceof Element)) return null;
      const desk = target.closest('[data-desk-id]');
      return desk?.getAttribute('data-desk-id') ?? null;
    };

    const handleClick = (event: MouseEvent) => {
      const id = deskFromEvent(event.target);
      if (id) onDeskClickRef.current(id);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const id = deskFromEvent(event.target);
      if (id) {
        event.preventDefault();
        onDeskClickRef.current(id);
      }
    };

    container.addEventListener('click', handleClick);
    container.addEventListener('keydown', handleKey);
    return () => {
      container.removeEventListener('click', handleClick);
      container.removeEventListener('keydown', handleKey);
    };
  }, [state]);

  // 3. Recolorisation a chaque changement de donnees.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || state !== 'ready') return;

    const desks = container.querySelectorAll<SVGGElement>('[data-desk-id]');
    desks.forEach((group) => {
      const deskId = group.getAttribute('data-desk-id');
      if (!deskId) return;

      const status = getDeskStatus({
        deskId,
        date,
        slot,
        bookings,
        currentUserName,
      });
      const booking = getDeskBooking({ deskId, date, slot, bookings });

      const fill = group.querySelector('.desk-fill');
      if (fill) fill.setAttribute('fill', FILL[status]);

      const outline = group.querySelector('path:not(.desk-fill)');
      if (outline) outline.setAttribute('stroke', STROKE[status]);

      const title = group.querySelector('title');
      const text = booking
        ? `${deskId} — occupe par ${booking.user_name}`
        : `${deskId} — libre`;
      if (title) title.textContent = text;
      group.setAttribute('aria-label', text);

      // Affiche le nom de l'occupant sur la place (ou l'identifiant si libre).
      const label = container.querySelector<SVGTextElement>(
        `[data-desk-label="${deskId}"] text`,
      );
      if (label) {
        if (booking) {
          label.textContent = booking.user_name;
          label.style.fontSize = '13px';
          label.style.fontWeight = '600';
        } else {
          label.textContent = deskId.replace('_', '.');
          label.style.fontSize = '';
          label.style.fontWeight = '';
        }
      }
    });
  }, [bookings, currentUserName, date, slot, state]);

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto rounded-lg border bg-white">
        {state === 'loading' && (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            Chargement du plan...
          </div>
        )}
        {state === 'error' && (
          <div className="flex h-48 items-center justify-center text-sm text-destructive">
            Impossible de charger le plan du 3eme etage.
          </div>
        )}
        <div
          ref={containerRef}
          className="floor-plan min-w-[1500px]"
          role="group"
          aria-label="Plan interactif du 3eme etage"
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <LegendItem color={FILL.free} label="Libre" />
        <LegendItem color={FILL.mine} label="Ma reservation" />
        <LegendItem color={FILL.occupied} label="Occupee" />
        <LegendItem color="#868e96" label="Non reservable" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-4 w-4 rounded border"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}
