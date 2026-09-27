'use client';

import { useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DailyPoint } from '@/lib/occupancy-stats';

// Palette validee (voir skill dataviz, validate_palette.js : tous les checks
// PASS en mode light sur surface #ffffff).
//   places  = slot categoriel 1 (bleu)   #2a78d6
//   bureaux = slot categoriel 2 (orange) #eb6834
// Les histogrammes sont mono-serie : encodage sequentiel, une seule teinte.
const COLOR = {
  seats: '#2a78d6',
  desks: '#eb6834',
  grid: '#eeedea',
  axis: '#52514e',
} as const;

const AXIS_TICK = { fontSize: 11, fill: COLOR.axis } as const;

/** Taux [0..1] -> "42 %". */
function formatRate(rate: number): string {
  return `${Math.round(rate * 100)} %`;
}

function formatDay(dateKey: string): string {
  return format(parseISO(dateKey), 'd MMM', { locale: fr });
}

// ============================================================
// Enveloppe commune : titre, graphique, repli tableau
// ============================================================

function ChartCard({
  title,
  hint,
  height,
  children,
  table,
}: {
  title: string;
  hint?: string;
  height: number;
  children: ReactNode;
  table: ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-white p-3 sm:p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-3" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Voir les donnees
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded border">
          {table}
        </div>
      </details>
    </section>
  );
}

function SimpleTable({
  head,
  rows,
}: {
  head: [string, string];
  rows: Array<[string, string]>;
}) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b bg-muted/50 text-muted-foreground">
          <th className="px-2 py-1 text-left font-medium">{head[0]}</th>
          <th className="px-2 py-1 text-right font-medium">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b last:border-0">
            <td className="px-2 py-1">{label}</td>
            <td className="px-2 py-1 text-right tabular-nums">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================================================
// 1. Occupation jour par jour
// ============================================================

export function DailyOccupancyChart({ series }: { series: DailyPoint[] }) {
  const [showDesks, setShowDesks] = useState(true);

  return (
    <section className="rounded-lg border bg-white p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Occupation jour par jour</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Jours ouvres uniquement. Un jour sans reservation compte pour 0 %.
          </p>
        </div>
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={showDesks}
            onChange={(event) => setShowDesks(event.target.checked)}
            className="h-3.5 w-3.5 accent-[#eb6834]"
          />
          Afficher les bureaux
        </label>
      </div>

      <div className="mt-3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={series}
            margin={{ top: 4, right: 8, bottom: 0, left: -18 }}
          >
            <CartesianGrid stroke={COLOR.grid} vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={formatDay}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: COLOR.grid }}
              minTickGap={24}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={formatRate}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <Tooltip
              cursor={{ stroke: COLOR.axis, strokeWidth: 1 }}
              labelFormatter={(value: string) =>
                format(parseISO(value), 'EEEE d MMMM yyyy', { locale: fr })
              }
              formatter={(value: number, name: string) => [
                formatRate(value),
                name,
              ]}
              contentStyle={{ fontSize: 12, borderRadius: 6 }}
            />
            {showDesks && <Legend wrapperStyle={{ fontSize: 12 }} />}
            <Line
              type="monotone"
              dataKey="seatRate"
              name="Places"
              stroke={COLOR.seats}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {showDesks && (
              <Line
                type="monotone"
                dataKey="deskRate"
                name="Bureaux"
                stroke={COLOR.desks}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <details className="mt-2">
        <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
          Voir les donnees
        </summary>
        <div className="mt-2 max-h-64 overflow-auto rounded border">
          <SimpleTable
            head={['Jour', 'Places / Bureaux']}
            rows={series.map((point) => [
              format(parseISO(point.date), 'EEE d MMM yyyy', { locale: fr }),
              `${formatRate(point.seatRate)} / ${formatRate(point.deskRate)}`,
            ])}
          />
        </div>
      </details>
    </section>
  );
}

// ============================================================
// 2. Moyenne par jour de la semaine
// ============================================================

export function WeekdayChart({
  data,
}: {
  data: Array<{ weekday: string; seatRate: number }>;
}) {
  return (
    <ChartCard
      title="Moyenne par jour de la semaine"
      hint="Taux d'occupation moyen des places sur la periode."
      height={220}
      table={
        <SimpleTable
          head={['Jour', 'Taux places']}
          rows={data.map((d) => [d.weekday, formatRate(d.seatRate)])}
        />
      }
    >
      <BarChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid stroke={COLOR.grid} vertical={false} />
        <XAxis
          dataKey="weekday"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: COLOR.grid }}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={formatRate}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: COLOR.grid }}
          formatter={(value: number) => [formatRate(value), 'Places']}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar
          dataKey="seatRate"
          fill={COLOR.seats}
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ChartCard>
  );
}

// ============================================================
// 3. Occupation par zone
// ============================================================

export function GroupRatesChart({
  data,
}: {
  data: Array<{ bureauGroup: string; rate: number }>;
}) {
  // 16 barres : hauteur proportionnelle pour rester lisible des 360px.
  const height = Math.max(200, data.length * 24 + 40);

  return (
    <ChartCard
      title="Occupation par zone"
      hint="Demi-journees reservees rapportees aux demi-journees disponibles de la zone."
      height={height}
      table={
        <SimpleTable
          head={['Zone', 'Taux']}
          rows={data.map((d) => [d.bureauGroup, formatRate(d.rate)])}
        />
      }
    >
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, bottom: 0, left: 4 }}
      >
        <CartesianGrid stroke={COLOR.grid} horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={formatRate}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: COLOR.grid }}
        />
        <YAxis
          type="category"
          dataKey="bureauGroup"
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={false}
          width={52}
        />
        <Tooltip
          cursor={{ fill: COLOR.grid }}
          formatter={(value: number) => [formatRate(value), 'Occupation']}
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
        />
        <Bar
          dataKey="rate"
          fill={COLOR.seats}
          radius={[0, 4, 4, 0]}
          maxBarSize={16}
        />
      </BarChart>
    </ChartCard>
  );
}
