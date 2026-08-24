import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { TableHead } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { SortDir } from "@/types/api";

/** Etiqueta de columna con una explicacion en tooltip. */
export function HeaderHint({ label, hint }: { label: string; hint: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="underline decoration-dotted underline-offset-4">{label}</span>
      </TooltipTrigger>
      <TooltipContent>{hint}</TooltipContent>
    </Tooltip>
  );
}

/**
 * Cabecera ordenable de una tabla paginada por el backend: el orden viaja en la
 * query, no en el cliente, para que ordene las miles de filas y no las 50 de la
 * pagina. Cambiar de orden vuelve a la primera pagina (no arrastra `offset`).
 */
export function SortHeader({
  basePath,
  params,
  column,
  sort,
  dir,
  label,
  hint,
  align,
  defaultDir = "asc",
}: {
  basePath: string;
  /** Filtros que hay que conservar. No incluye sort, dir ni offset. */
  params: Record<string, string>;
  column: string;
  sort: string;
  dir: SortDir;
  label: string;
  hint?: string;
  align?: "end";
  defaultDir?: SortDir;
}) {
  const active = sort === column;
  const next: SortDir = active ? (dir === "asc" ? "desc" : "asc") : defaultDir;
  const href = `${basePath}?${new URLSearchParams({ ...params, sort: column, dir: next })}`;
  const Icon = !active ? ChevronsUpDown : dir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead
      className={align === "end" ? "text-right" : undefined}
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : undefined}
    >
      <Button asChild variant="ghost" size="sm" className={align === "end" ? "ml-auto" : undefined}>
        <Link href={href}>
          {hint ? <HeaderHint label={label} hint={hint} /> : label}
          <Icon aria-hidden="true" className={active ? undefined : "opacity-50"} />
        </Link>
      </Button>
    </TableHead>
  );
}
