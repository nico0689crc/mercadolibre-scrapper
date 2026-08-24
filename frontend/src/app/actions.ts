"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { runScan } from "@/lib/api";

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
