// Transforme floor-plan-raw.svg (export Excalidraw) en public/floor-plan.svg
// en injectant les attributs data-desk-id sur les 47 carrés orange reservables.
//
// Excalidraw n'exporte pas de <rect> : chaque forme est un <g> contenant deux
// <path> (un de remplissage, un de contour). Les places reservables ont le
// remplissage orange #ffd8a8 ; les places non reservables sont grises #868e96.
//
// Strategie de matching : le centre geometrique de chaque carre orange coincide
// exactement avec le centre du label texte de la place. On associe donc chaque
// carre au label le plus proche (distance euclidienne).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'floor-plan-raw.svg');
const OUT = join(ROOT, 'public', 'floor-plan.svg');

const ORANGE = '#ffd8a8';
const raw = readFileSync(SRC, 'utf8');

// --- 1. Extraction des labels texte -----------------------------------------
const TEXT_RE =
  /<g transform="translate\(([0-9.eE+-]+) ([0-9.eE+-]+)\) rotate\(([0-9.]+) ([0-9.eE+-]+) ([0-9.eE+-]+)\)"><text[^>]*>([^<]*)<\/text><\/g>/g;

const labels = [];
for (const m of raw.matchAll(TEXT_RE)) {
  const tx = parseFloat(m[1]);
  const ty = parseFloat(m[2]);
  const cx = parseFloat(m[4]);
  const cy = parseFloat(m[5]);
  labels.push({ text: m[6].trim(), x: tx + cx, y: ty + cy });
}

// --- 2. Filtrage des labels de place ----------------------------------------
const isPlaceLabel = (t) =>
  /^3\.\d+-\d+$/.test(t) || /^OS.+-\d+$/.test(t) || /^SDR\d+-\d+$/.test(t);

const placeLabels = labels.filter((l) => isPlaceLabel(l.text));

// --- 3. Transformation label SVG -> deskId Supabase -------------------------
const toDeskId = (label) =>
  /^OS4\.[123]-\d+$/.test(label) ? label.replace('.', '_') : label;

// --- 4. Extraction des formes (carres) --------------------------------------
const SHAPE_RE =
  /<g stroke-linecap="round" transform="translate\(([0-9.eE+-]+) ([0-9.eE+-]+)\) rotate\(([0-9.]+) ([0-9.eE+-]+) ([0-9.eE+-]+)\)">([\s\S]*?)<\/g>/g;

const oranges = [];
for (const m of raw.matchAll(SHAPE_RE)) {
  if (!m[6].includes(`fill="${ORANGE}"`)) continue;
  const tx = parseFloat(m[1]);
  const ty = parseFloat(m[2]);
  const cx = parseFloat(m[4]);
  const cy = parseFloat(m[5]);
  oranges.push({ full: m[0], x: tx + cx, y: ty + cy });
}

// --- 5. Matching carre orange -> label le plus proche -----------------------
const problems = [];
const assignments = []; // { full, deskId, dist }
const usedLabels = new Set();

for (const o of oranges) {
  let best = null;
  let bestDist = Infinity;
  for (const l of placeLabels) {
    const d = Math.hypot(o.x - l.x, o.y - l.y);
    if (d < bestDist) {
      bestDist = d;
      best = l;
    }
  }
  if (!best || bestDist > 60) {
    problems.push(
      `Carre orange sans label de place a proximite : centre (${o.x}, ${o.y})`,
    );
    continue;
  }
  const deskId = toDeskId(best.text);
  if (usedLabels.has(deskId)) {
    problems.push(
      `Label "${best.text}" associe a plusieurs carres (centre carre ${o.x}, ${o.y})`,
    );
  }
  usedLabels.add(deskId);
  assignments.push({ full: o.full, deskId, label: best.text, dist: bestDist });
}

// --- 6. Verification des 47 deskIds attendus --------------------------------
const expected = [
  '3.06-1', '3.07-1', '3.08-1', '3.09-1', '3.09-2', '3.10-1', '3.11-1',
  '3.12-1', '3.13-1', '3.13-2', '3.14-1', '3.14-2', '3.32-1', '3.32-2',
  '3.33-1', '3.34-1', '3.34-2',
  'OS4_1-1', 'OS4_1-2', 'OS4_1-3', 'OS4_1-4',
  'OS4_2-1', 'OS4_2-2', 'OS4_2-3', 'OS4_2-4',
  'OS4_3-1', 'OS4_3-2', 'OS4_3-3', 'OS4_3-4',
  'OS6-1', 'OS6-2', 'OS6-3', 'OS6-4', 'OS6-5', 'OS6-6',
  'SDR1-1', 'SDR1-2', 'SDR1-3', 'SDR1-4', 'SDR1-5', 'SDR1-6',
  'SDR2-1', 'SDR2-2', 'SDR2-3', 'SDR2-4', 'SDR2-5', 'SDR2-6',
];

const found = new Set(assignments.map((a) => a.deskId));
for (const id of expected) {
  if (!found.has(id)) problems.push(`deskId attendu manquant : ${id}`);
}
for (const id of found) {
  if (!expected.includes(id)) problems.push(`deskId inattendu detecte : ${id}`);
}

if (problems.length > 0) {
  console.error('\n=== PROBLEMES DETECTES ===');
  for (const p of problems) console.error(' - ' + p);
  console.error(`\n${assignments.length} carres associes / 47 attendus.`);
  process.exit(1);
}

// --- 7. Injection des attributs dans le SVG ---------------------------------
let out = raw;
for (const a of assignments) {
  const escId = a.deskId.replace(/"/g, '&quot;');
  const opened = a.full.replace(
    '<g stroke-linecap="round"',
    `<g id="desk-${escId}" data-desk-id="${escId}" class="desk" role="button" tabindex="0" aria-label="${escId}" style="cursor:pointer" stroke-linecap="round"`,
  );
  // classe sur le path de remplissage pour le recolorage dynamique
  const withFill = opened.replace(
    `fill="${ORANGE}"`,
    `class="desk-fill" fill="${ORANGE}"`,
  );
  // <title> vide pour le tooltip natif (mis a jour par FloorPlan)
  const withTitle = withFill.replace(/>/, '><title></title>');
  out = out.replace(a.full, withTitle);
}

// SVG responsive : on conserve viewBox, on retire width/height fixes
out = out.replace(
  /<svg version="1.1"([^>]*?) width="3700" height="620">/,
  '<svg version="1.1"$1>',
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, out, 'utf8');

console.log(`OK : ${assignments.length} places reservables injectees.`);
console.log(`Distance de matching max : ${Math.max(...assignments.map((a) => a.dist)).toFixed(2)} px`);
console.log(`Fichier ecrit : ${OUT}`);
