"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { DomainResolution } from "@/types/api";
import {
  acceptManufacturer,
  rejectManufacturer,
  resolveDomain,
  runScan,
} from "@/lib/api";

/** Las unicas pantallas con barra de filtros. */
const FILTERABLE = new Set(["/categories", "/brands", "/products"]);

/**
 * Aplica la barra de filtros: arma la url limpia y redirige.
 *
 * Un form GET mandaria tambien los campos vacios (`?q=&minItems=`), y ademas
 * arrastraria el `offset`. Con la action la url queda solo con lo que filtra
 * de verdad y siempre vuelve a la primera pagina.
 */
export async function applyFiltersAction(
  basePath: string,
  formData: FormData,
): Promise<void> {
  const target = FILTERABLE.has(basePath) ? basePath : "/";
  const params = new URLSearchParams();

  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    const clean = value.trim();
    // "any" es el default de los tri-estado: no hace falta en la url.
    if (!clean || clean === "any") continue;
    params.set(key, clean);
  }

  redirect(params.size > 0 ? `${target}?${params.toString()}` : target);
}

export interface ScanActionResult {
  ok: boolean;
  message: string;
}

/** Dispara un scan de marcas contra ML y refresca la pagina de la categoria. */
export async function scanCategoryAction(categoryId: string): Promise<ScanActionResult> {
  try {
    const run = await runScan(categoryId);

    if (run.status === "error") {
      return { ok: false, message: run.error ?? "El scan fallo" };
    }

    revalidatePath(`/categories/${categoryId}`);
    revalidatePath("/");

    return {
      ok: true,
      message: `${run.brandsFound} marcas sobre ${run.sampled.toLocaleString("es-AR")} productos (${run.brandsNew} nuevas)`,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}


export interface CurateActionResult {
  ok: boolean;
  message: string;
}

/**
 * Acepta una marca como fabricante. El dominio oficial no es un adorno: es de
 * donde se va a bajar el manual, asi que sin el la marca no sirve para nada.
 */
export async function acceptManufacturerAction(
  brandId: string,
  formData: FormData,
): Promise<CurateActionResult> {
  const raw = String(formData.get("officialDomains") ?? "");
  const notes = String(formData.get("notes") ?? "").trim();

  // Acepta "drean.com.ar, www.drean.com.ar" y limpia protocolo y barras.
  const officialDomains = raw
    .split(/[,\s]+/)
    .map((d) => d.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").toLowerCase())
    .filter(Boolean);

  if (officialDomains.length === 0) {
    return { ok: false, message: "Hace falta al menos un dominio oficial" };
  }

  try {
    const m = await acceptManufacturer(brandId, {
      officialDomains,
      notes: notes || undefined,
    });
    revalidatePath("/manufacturers");
    return { ok: true, message: `${m.name} quedo verificada en ${officialDomains[0]}` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

/** Descarta la marca: vendedor de marketplace, marca propia de retail o basura. */
export async function rejectManufacturerAction(
  brandId: string,
  formData: FormData,
): Promise<CurateActionResult> {
  const notes = String(formData.get("notes") ?? "").trim();

  try {
    const m = await rejectManufacturer(brandId, { notes: notes || undefined });
    revalidatePath("/manufacturers");
    return { ok: true, message: `${m.name} quedo descartada` };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}


export interface ResolveActionResult {
  ok: boolean;
  message: string;
  resolution?: DomainResolution;
}

/**
 * Propone el dominio oficial de una marca. `useSearch` en false usa solo la
 * heuristica del nombre y no consume cupo de Brave.
 */
export async function resolveDomainAction(
  brandId: string,
  useSearch: boolean,
): Promise<ResolveActionResult> {
  try {
    const resolution = await resolveDomain(brandId, useSearch);

    if (!resolution.best) {
      return { ok: false, message: "Ningun dominio candidato respondio", resolution };
    }

    const how = resolution.agreement
      ? "las dos fuentes coinciden"
      : resolution.usedSearch
        ? "solo una fuente lo propone"
        : "solo heuristica, sin gastar cupo";

    return { ok: true, message: `${resolution.best.domain} (${how})`, resolution };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
