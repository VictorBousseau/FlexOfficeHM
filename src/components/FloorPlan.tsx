'use client';

import { useEffect, useRef, useState } from 'react';

import { getDeskDay } from '@/lib/booking-rules';
import type { Booking } from '@/types/database';

interface FloorPlanProps {
  bookings: Booking[];
  currentUserName: string;
  date: Date;
  onDeskClick: (deskId: string) => void;
}

type Status = 'free' | 'mine' | 'occupied';

const FILL: Record<Status, string> = {
  free: '#bbf7d0',
  mine: '#bfdbfe',
  occupied: '#fecaca',
};

const STROKE: Record<Status, string> = {
  free: '#16a34a',
  mine: '#2563eb',
  occupied: '#dc2626',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

// Combinaisons matin/apres-midi differentes -> degrade scinde en deux.
const MIXED: ReadonlyArray<readonly [Status, Status]> = [
  ['free', 'mine'],
  ['free', 'occupied'],
  ['mine', 'free'],
  ['mine', 'occupied'],
  ['occupied', 'free'],
  ['occupied', 'mine'],
];

export function FloorPlan({
  bookings,
  currentUserName,
  date,
  onDeskClick,
}: FloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

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
        containerRef.current.innerHTML = start >= 0 ? text.slice(start) : text;
        const svg = containerRef.current.querySelector('svg');
        if (svg) {
          svg.setAttribute('width', '100%');
          svg.removeAttribute('height');
          svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
          svg.style.height = 'auto';
          svg.style.display = 'block';

          // Degrades pour les places reservees sur une seule demi-journee :
          // moitie gauche = matin, moitie droite = apres-midi.
          let defs = svg.querySelector('defs');
          if (!defs) {
            defs = document.createElementNS(SVG_NS, 'defs');
            svg.insertBefore(defs, svg.firstChild);
          }
          for (const [morning, afternoon] of MIXED) {
            const grad = document.createElementNS(SVG_NS, 'linearGradient');
            grad.setAttribute('id', `split-${morning}-${afternoon}`);
            grad.setAttribute('x1', '0');
            grad.setAttribute('y1', '0');
            grad.setAttribute('x2', '1');
            grad.setAttribute('y2', '0');
            const stopA = document.createElementNS(SVG_NS, 'stop');
            stopA.setAttribute('offset', '50%');
            stopA.setAttribute('stop-color', FILL[morning]);
            const stopB = document.createElementNS(SVG_NS, 'stop');
            stopB.setAttribute('offset', '50%');
            stopB.setAttribute('stop-color', FILL[afternoon]);
            grad.append(stopA, stopB);
            defs.append(grad);
          }
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

  // 2. Listeners delegues (clic + clavier).
  useEffect(() => {
    const container = containerRef.current;
    if (!container || state !== 'ready') return;

    const deskFromEvent = (target: EventTarget | null): string | null => {
      if (!(target instanceof Element)) return null;
      return target.closest('[data-desk-id]')?.getAttribute('data-desk-id') ?? null;
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

      const day = getDeskDay({ deskId, date, bookings, currentUserName });
      const m = day.morning.status;
      const a = day.afternoon.status;

      const fill = group.querySelector('.desk-fill');
      if (fill) {
        fill.setAttribute(
          'fill',
          m === a ? FILL[m] : `url(#split-${m}-${a})`,
        );
      }
      const outline = group.querySelector('path:not(.desk-fill)');
      if (outline) {
        outline.setAttribute('stroke', m === a ? STROKE[m] : '#334155');
      }

      // Libelle : nom de l'occupant s'il est unique, sinon l'identifiant.
      const names = [
        day.morning.booking?.user_name,
        day.afternoon.booking?.user_name,
      ].filter((n): n is string => Boolean(n));
      const distinct = [...new Set(names)];
      const label = container.querySelector<SVGTextElement>(
        `[data-desk-label="${deskId}"] text`,
      );
      if (label) {
        if (distinct.length === 1) {
          label.textContent = distinct[0];
          label.style.fontSize = '13px';
          label.style.fontWeight = '600';
        } else {
          label.textContent = deskId.replace('_', '.');
          label.style.fontSize = '';
          label.style.fontWeight = '';
        }
      }

      // Tooltip natif + accessibilite.
      const slotText = (s: typeof day.morning): string =>
        s.booking ? s.booking.user_name : 'libre';
      const text = `${deskId} — Matin : ${slotText(day.morning)} · Apres-midi : ${slotText(day.afternoon)}`;
      const title = group.querySelector('title');
      if (title) title.textContent = text;
      group.setAttribute('aria-label', text);
    });
  }, [bookings, currentUserName, date, state]);

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
          className="floor-plan min-w-[2100px]"
          role="group"
          aria-label="Plan interactif du 3eme etage"
        />
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <LegendItem color={FILL.free} label="Libre" />
        <LegendItem color={FILL.mine} label="Ma reservation" />
        <LegendItem color={FILL.occupied} label="Occupee" />
        <LegendItem
          label="Demi-journee (matin / apres-midi)"
          gradient={`linear-gradient(90deg, ${FILL.free} 50%, ${FILL.occupied} 50%)`}
        />
        <LegendItem color="#868e96" label="Non reservable" />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  gradient,
  label,
}: {
  color?: string;
  gradient?: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span
        className="inline-block h-4 w-4 rounded border"
        style={gradient ? { backgroundImage: gradient } : { backgroundColor: color }}
      />
      {label}
    </span>
  );
}
