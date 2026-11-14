import { APP_TIMEZONE, METRICS, type MetricKey } from "./constants";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "12 Nov 2026, 08:14 UTC" — the app stores and displays UTC, labelled explicitly. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "No record";
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${day} ${month} ${date.getUTCFullYear()}, ${hours}:${minutes} ${APP_TIMEZONE}`;
}

/** "12 Nov" — compact label for charts and tables. */
export function formatShortDate(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${day} ${MONTHS[date.getUTCMonth()]}`;
}

export function formatDayLabel(value: string | Date | null | undefined): string {
  const date = toDate(value);
  if (!date) return "—";
  const day = date.getUTCDate().toString().padStart(2, "0");
  const month = MONTHS[date.getUTCMonth()];
  const hours = date.getUTCHours().toString().padStart(2, "0");
  const minutes = date.getUTCMinutes().toString().padStart(2, "0");
  return `${day} ${month} · ${hours}:${minutes}`;
}

export function formatAge(hours: number | null): string {
  if (hours === null || Number.isNaN(hours)) return "unknown age";
  if (hours < 1) return "under 1 h old";
  if (hours < 24) return `${Math.round(hours)} h old`;
  const days = hours / 24;
  if (days < 14) return `${days.toFixed(days < 10 ? 1 : 0)} d old`;
  return `${Math.round(days)} d old`;
}

export function formatNumber(value: number | null, decimals = 0): string {
  if (value === null || Number.isNaN(value)) return "—";
  return value.toFixed(decimals);
}

export function formatMetricValue(metric: MetricKey, numeric: number | null, text: string | null): string {
  const definition = METRICS[metric];
  if (definition.kind === "choice") {
    const choice = definition.choices?.find((item) => item.value === text);
    return choice ? choice.label : "Not recorded";
  }
  if (numeric === null) return "Not recorded";
  return `${formatNumber(numeric, definition.decimals)} ${definition.unit}`.trim();
}

export function formatDelta(delta: number | null, metric: MetricKey): string {
  if (delta === null || Number.isNaN(delta)) return "no baseline";
  const sign = delta > 0 ? "+" : "";
  const decimals = METRICS[metric].decimals;
  return `${sign}${delta.toFixed(decimals)} ${METRICS[metric].unit}`.trim();
}

export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural ?? `${singular}s`);
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1).trimEnd()}…`;
}

export function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
