import type { ReactNode } from "react";

import { Breadcrumbs, type Crumb } from "@/components/layout/breadcrumbs";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Marco de cada pantalla: la barra fija de arriba (con el toggle de la barra
 * lateral y la ruta) y el contenido debajo, a todo el ancho.
 *
 * Lo renderiza la pagina y no el layout a proposito: asi la ruta se arma en el
 * servidor con los nombres reales (categoria, producto) en vez de adivinarlos
 * desde el pathname. Sin `crumbs` es el esqueleto que usa loading.tsx.
 */
export function PageShell({ crumbs, children }: { crumbs?: Crumb[]; children: ReactNode }) {
  return (
    <>
      <header className="bg-background sticky top-0 z-10 flex h-14 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-4" />
        {crumbs ? <Breadcrumbs items={crumbs} /> : <Skeleton className="h-4 w-48" />}
      </header>
      <div className="w-full flex-1 space-y-8 p-4 md:p-6">{children}</div>
    </>
  );
}
