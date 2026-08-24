import type { ReactNode } from "react";
import Link from "next/link";
import { SlidersHorizontal, X } from "lucide-react";

import { applyFiltersAction } from "@/app/actions";
import { FilterSelect } from "@/components/catalog/filter-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { Tristate } from "@/types/api";

/** Filtro activo, con el link que lo saca. */
export interface ActiveFilter {
  key: string;
  label: string;
  href: string;
}

/**
 * Barra de filtros de un listado. Es un form con server action: la action arma
 * la url y redirige, asi la query queda limpia y el filtro es compartible.
 * `keep` son los valores que no se editan aca (el orden) y hay que conservar.
 */
export function FilterBar({
  basePath,
  keep,
  chips = [],
  children,
}: {
  basePath: string;
  keep?: Record<string, string>;
  chips?: ActiveFilter[];
  children: ReactNode;
}) {
  return (
    <Card>
      <CardContent>
        <form action={applyFiltersAction.bind(null, basePath)} className="space-y-4">
          {Object.entries(keep ?? {}).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}

          <div className="flex flex-col gap-6">{children}</div>

          <Separator />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {chips.length === 0 ? (
                <span className="text-muted-foreground text-sm">Sin filtros activos</span>
              ) : (
                chips.map((chip) => (
                  <Badge key={chip.key} variant="secondary" asChild>
                    <Link href={chip.href}>
                      {chip.label}
                      <X className="size-3" aria-hidden="true" />
                      <span className="sr-only">Quitar este filtro</span>
                    </Link>
                  </Badge>
                ))
              )}
            </div>

            <div className="flex items-center gap-2">
              {chips.length > 0 ? (
                <Button asChild variant="ghost" size="sm">
                  <Link href={basePath}>Limpiar todo</Link>
                </Button>
              ) : null}
              <Button type="submit" size="sm">
                <SlidersHorizontal aria-hidden="true" />
                Aplicar
              </Button>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Un escalon de la barra: los controles que dependen del mismo recorte van
 * juntos y en orden. Primero el arbol (categoria -> subcategoria -> ...), y
 * despues lo que se apoya en el.
 */
export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
          {label}
        </span>
        <Separator className="flex-1" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </div>
  );
}

/** Etiqueta + control de un filtro. */
export function FilterField({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
    </div>
  );
}

/** Filtro de tres estados: todas / cumple / no cumple. */
export function TristateField({
  name,
  label,
  value,
  yes,
  no,
  all = "Todas",
  hint,
}: {
  name: string;
  label: string;
  value: Tristate;
  yes: string;
  no: string;
  all?: string;
  hint?: string;
}) {
  return (
    <FilterField label={label} htmlFor={name} hint={hint}>
      <FilterSelect
        id={name}
        name={name}
        defaultValue={value}
        options={[
          { value: "any", label: all },
          { value: "yes", label: yes },
          { value: "no", label: no },
        ]}
      />
    </FilterField>
  );
}
