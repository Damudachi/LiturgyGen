/**
 * What a calendar tile says about its day, from a /calendar/month entry.
 * Pure functions only; no React.
 */

import { formatLong } from './dates.js';

const COLOUR_CLASS = {
  GREEN: 'bg-lit-green',
  PURPLE: 'bg-lit-violet',
  RED: 'bg-lit-red',
  ROSE: 'bg-lit-rose',
  GOLD: 'bg-lit-gold',
  WHITE: 'bg-lit-white',
  BLACK: 'bg-lit-black',
};

/** Tailwind class for the tile's colour stripe. */
export function stripeClass(day) {
  const key = day && day.celebration && day.celebration.color && day.celebration.color.key;
  return COLOUR_CLASS[key] || 'bg-lit-green';
}

export function isLiturgicalWhite(day) {
  return Boolean(day && day.celebration && day.celebration.color && day.celebration.color.key === 'WHITE');
}

const titleCase = (text) =>
  text
    .toLowerCase()
    .replace(/(^|[\s(-])([a-zà-ÿ])/g, (_, lead, letter) => lead + letter.toUpperCase())
    .replace(/\b(Of|The|And|In|To|A)\b/g, (word) => word.toLowerCase())
    .replace(/^([a-z])/, (letter) => letter.toUpperCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n, suffix) => n + suffix.toLowerCase());

/**
 * The short line under the date: the celebration's name for anything the day
 * keeps (solemnities, feasts, memorials, Sundays), "Weekday" otherwise.
 */
export function tileLabel(day) {
  if (!day || !day.celebration) return '';
  const { rank, name } = day.celebration;
  if (rank === 'WEEKDAY') return 'Weekday';
  if (rank === 'SUNDAY' && day.occasionTitle) return titleCase(day.occasionTitle);
  return name || (day.occasionTitle ? titleCase(day.occasionTitle) : '');
}

/** Everything a screen reader needs, since the stripe is colour alone. */
export function tileAriaLabel(day, iso, { ticked = false } = {}) {
  const parts = [formatLong(iso)];
  if (day && day.celebration) {
    parts.push(day.occasionTitle ? titleCase(day.occasionTitle) : day.celebration.name);
    if (day.celebration.rankLabel) parts.push(day.celebration.rankLabel);
    if (day.celebration.color && day.celebration.color.name) parts.push(day.celebration.color.name);
  }
  if (ticked) parts.push('chosen');
  return parts.filter(Boolean).join(', ');
}

/** Grid index after an arrow key, clamped to real days in the month. */
export function moveFocus(cells, index, key) {
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[key];
  if (!step) return index;
  let next = index + step;
  while (next >= 0 && next < cells.length && !cells[next]) next += step > 0 ? 1 : -1;
  return next >= 0 && next < cells.length && cells[next] ? next : index;
}
