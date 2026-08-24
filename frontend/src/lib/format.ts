const NUMBER = new Intl.NumberFormat("es-AR");
const RELATIVE = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.35],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
];

export function count(value: number): string {
  return NUMBER.format(value);
}

/** "hace 3 minutos", "ayer". Se calcula en el servidor, en cada request. */
export function relative(value: string | null): string {
  if (!value) return "nunca";

  let amount = (new Date(value).getTime() - Date.now()) / 1000;
  for (const [unit, size] of STEPS) {
    if (Math.abs(amount) < size) return RELATIVE.format(Math.round(amount), unit);
    amount /= size;
  }
  return RELATIVE.format(Math.round(amount), "year");
}

export function dateTime(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function money(value: string | null, currency: string | null): string {
  if (!value) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("es-AR", {
    style: "currency",
    currency: currency ?? "ARS",
    maximumFractionDigits: 0,
  });
}
