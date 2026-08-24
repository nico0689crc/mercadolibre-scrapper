"use server";

import { revalidatePath } from "next/cache";

import { runScan } from "@/lib/api";

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
