'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { getDeskDay, isRoomBookedTile } from '@/lib/booking-rules';
import { cn } from '@/lib/utils';
import type { Booking, Desk } from '@/types/database';

interface FloorPlanProps {
  desks: Desk[];
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

// Marqueur double ecran.
const STAR_GLYPH = '★';
const STAR_COLOR = '#b45309';

// Liseré des places couvertes par une privatisation de salle.
const ROOM_DASH = '6 4';

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
  desks,
  bookings,
  currentUserName,
  date,
  onDeskClick,
}: FloorPlanProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  const desksById = useMemo(() => {
    const map = new Map<string, Desk>();
    for (const desk of desks) map.set(desk.id, desk);
    return map;
  }, [desks]);

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

    const svg = container.querySelector('svg');
    if (svg) {
      syncDualScreenStars(
        svg,
        new Set(
          [...desksById.values()]
            .filter((d) => d.has_dual_screen)
            .map((d) => d.id),
        ),
      );
    }

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
        // Liseré pointillé sur les places couvertes par une salle privatisée.
        if (isRoomBookedTile({ deskId, date, bookings })) {
          outline.setAttribute('stroke-dasharray', ROOM_DASH);
        } else {
          outline.removeAttribute('stroke-dasharray');
        }
      }

      // Libelle : equipe si la salle est privatisee, sinon nom de l'occupant
      // s'il est unique, sinon l'identifiant de la place.
      const teams = [
        day.morning.booking?.team_label,
        day.afternoon.booking?.team_label,
      ].filter((t): t is string => Boolean(t));
      const distinctTeams = [...new Set(teams)];
      const names = [
        day.morning.booking?.user_name,
        day.afternoon.booking?.user_name,
      ].filter((n): n is string => Boolean(n));
      const distinct = [...new Set(names)];
      const label = container.querySelector<SVGTextElement>(
        `[data-desk-label="${deskId}"] text`,
      );
      if (label) {
        const custom =
          distinctTeams.length === 1
            ? distinctTeams[0]
            : distinct.length === 1
              ? distinct[0]
              : null;
        if (custom) {
          label.textContent = custom;
          label.style.fontSize = '13px';
          label.style.fontWeight = '600';
        } else {
          label.textContent = deskId.replace('_', '.');
          label.style.fontSize = '';
          label.style.fontWeight = '';
        }
      }

      // Tooltip natif + accessibilite.
      const slotText = (s: typeof day.morning): string => {
        if (!s.booking) return 'libre';
        return s.booking.team_label
          ? `${s.booking.user_name} (salle entiere — ${s.booking.team_label})`
          : s.booking.user_name;
      };
      const dualText = desksById.get(deskId)?.has_dual_screen
        ? ' · Double ecran'
        : '';
      const text = `${deskId} — Matin : ${slotText(day.morning)} · Apres-midi : ${slotText(day.afternoon)}${dualText}`;
      const title = group.querySelector('title');
      if (title) title.textContent = text;
      group.setAttribute('aria-label', text);
    });
  }, [bookings, currentUserName, date, desksById, state]);

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
        <LegendItem dashed label="Salle privatisee" />
        <LegendItem glyph={STAR_GLYPH} label="Double ecran" />
        <LegendItem color="#868e96" label="Non reservable" />
      </div>
    </div>
  );
}

/**
 * Coin visuel haut-droit d'une tuile, exprime dans le repere de `target`.
 *
 * Indispensable : une partie des tuiles Excalidraw portent un
 * `rotate(270 ...)`. Placer l'etoile dans le repere local du groupe la ferait
 * atterrir dans le mauvais coin et couchee sur le flanc. On projette donc les
 * quatre coins de la bbox dans le repere de la couche d'etoiles.
 */
function topRightIn(
  target: SVGGraphicsElement,
  source: SVGGraphicsElement,
): { x: number; y: number } | null {
  const from = source.getScreenCTM();
  const to = target.getScreenCTM();
  if (!from || !to) return null;

  let box: DOMRect;
  try {
    box = source.getBBox();
  } catch {
    // getBBox leve si l'element n'est pas encore rendu : on reessaiera au
    // prochain passage de l'effet.
    return null;
  }

  const matrix = to.inverse().multiply(from);
  const svg = source.ownerSVGElement;
  if (!svg) return null;

  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => {
    const point = svg.createSVGPoint();
    point.x = x;
    point.y = y;
    return point.matrixTransform(matrix);
  });

  return {
    x: Math.max(...corners.map((c) => c.x)),
    y: Math.min(...corners.map((c) => c.y)),
  };
}

/**
 * Synchronise les marqueurs double ecran. Les etoiles vivent dans une couche
 * dediee a la racine du SVG (donc toujours droites et au-dessus des tuiles),
 * pas dans les groupes de places.
 */
function syncDualScreenStars(
  svg: SVGSVGElement,
  dualScreenIds: Set<string>,
): void {
  let layer = svg.querySelector<SVGGElement>('#desk-stars');
  if (!layer) {
    layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('id', 'desk-stars');
    svg.append(layer);
  }

  for (const star of layer.querySelectorAll('[data-star-for]')) {
    const id = star.getAttribute('data-star-for');
    if (!id || !dualScreenIds.has(id)) star.remove();
  }

  for (const deskId of dualScreenIds) {
    if (layer.querySelector(`[data-star-for="${deskId}"]`)) continue;

    const fill = svg.querySelector(
      `[data-desk-id="${deskId}"] .desk-fill`,
    );
    if (!(fill instanceof SVGGraphicsElement)) continue;

    const corner = topRightIn(layer, fill);
    if (!corner) continue;

    const star = document.createElementNS(SVG_NS, 'text');
    star.setAttribute('class', 'desk-star');
    star.setAttribute('data-star-for', deskId);
    star.setAttribute('x', String(corner.x - 3));
    star.setAttribute('y', String(corner.y + 14));
    star.setAttribute('text-anchor', 'end');
    star.setAttribute('font-size', '13');
    star.setAttribute('fill', STAR_COLOR);
    star.textContent = STAR_GLYPH;
    layer.append(star);
  }
}

function LegendItem({
  color,
  gradient,
  dashed,
  glyph,
  label,
}: {
  color?: string;
  gradient?: string;
  dashed?: boolean;
  glyph?: string;
  label: string;
}) {
  return (
    <span className="flex items-center gap-2">
      {glyph ? (
        <span
          aria-hidden
          className="inline-flex h-4 w-4 items-center justify-center text-base leading-none"
          style={{ color: STAR_COLOR }}
        >
          {glyph}
        </span>
      ) : (
        <span
          className={cn(
            'inline-block h-4 w-4 rounded border',
            dashed && 'border-2 border-dashed border-slate-600',
          )}
          style={
            gradient ? { backgroundImage: gradient } : { backgroundColor: color }
          }
        />
      )}
      {label}
    </span>
  );
}
