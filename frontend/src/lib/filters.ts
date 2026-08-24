/** Utilidades para las urls de la barra de filtros. */

/** El mismo listado sin uno de sus filtros. Es el link de la X de cada chip. */
export function without(
  basePath: string,
  params: Record<string, string>,
  key: string,
): string {
  const rest = Object.fromEntries(Object.entries(params).filter(([k]) => k !== key));
  const query = new URLSearchParams(rest).toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Primer valor de un search param, ignorando el vacio. */
export function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/** Entero positivo de un search param, o undefined si no lo es. */
export function positive(value: string | string[] | undefined): number | undefined {
  const parsed = Number(one(value));
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

const ML_ID = /^[A-Z]{3}\d+$/;

/**
 * Id de categoria de ML, o undefined. Evita mandarle basura al backend, que
 * responde 400 y le rompe la pantalla al usuario.
 */
export function categoryId(value: string | string[] | undefined): string | undefined {
  const raw = one(value);
  return raw && ML_ID.test(raw) ? raw : undefined;
}

/** Texto de un select: `any` es su valor vacio, nunca un filtro real. */
export function text(value: string | string[] | undefined): string | undefined {
  const raw = one(value);
  return raw === "any" ? undefined : raw;
}

/** Descarta lo que no sea uno de los valores permitidos. */
export function oneOf<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const found = allowed.find((option) => option === one(value));
  return found ?? fallback;
}
