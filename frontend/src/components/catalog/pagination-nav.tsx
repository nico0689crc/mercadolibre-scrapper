import Link from "next/link";

import { Button } from "@/components/ui/button";

/** Anterior/Siguiente conservando el resto de los filtros de la query. */
export function PaginationNav({
  basePath,
  params,
  offset,
  pageSize,
  total,
}: {
  basePath: string;
  params: Record<string, string>;
  offset: number;
  pageSize: number;
  total: number;
}) {
  const build = (next: number) =>
    `${basePath}?${new URLSearchParams({ ...params, offset: String(next) })}`;

  const hasPrev = offset > 0;
  const hasNext = offset + pageSize < total;

  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm tabular-nums">
        {total === 0 ? 0 : offset + 1}–{Math.min(offset + pageSize, total)} de{" "}
        {total.toLocaleString("es-AR")}
      </p>
      <div className="flex gap-2">
        {hasPrev ? (
          <Button asChild variant="outline" size="sm">
            <Link href={build(Math.max(0, offset - pageSize))}>Anterior</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Anterior
          </Button>
        )}
        {hasNext ? (
          <Button asChild variant="outline" size="sm">
            <Link href={build(offset + pageSize)}>Siguiente</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Siguiente
          </Button>
        )}
      </div>
    </div>
  );
}
