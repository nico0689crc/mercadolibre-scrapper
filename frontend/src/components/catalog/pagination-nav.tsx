import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
} from "@/components/ui/pagination";

/** Ventana de paginas alrededor de la actual: 1 … 4 5 6 … 20. */
function pageWindow(current: number, last: number): (number | "gap")[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);

  const pages = new Set([1, last, current, current - 1, current + 1]);
  if (current <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (current >= last - 2) [last - 3, last - 2, last - 1].forEach((p) => pages.add(p));

  const sorted = [...pages].filter((p) => p >= 1 && p <= last).sort((a, b) => a - b);

  return sorted.flatMap((page, index) =>
    index > 0 && page - sorted[index - 1] > 1 ? ["gap" as const, page] : [page],
  );
}

/** Paginado por offset conservando el resto de la query (filtros y orden). */
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
  if (total === 0) return null;

  const href = (nextOffset: number) =>
    `${basePath}?${new URLSearchParams({ ...params, offset: String(nextOffset) })}`;

  const last = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(last, Math.floor(offset / pageSize) + 1);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <p className="text-muted-foreground text-sm tabular-nums">
        {offset + 1}–{Math.min(offset + pageSize, total)} de {total.toLocaleString("es-AR")}
      </p>

      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            {current > 1 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={href((current - 2) * pageSize)} aria-label="Pagina anterior">
                  <ChevronLeft aria-hidden="true" />
                  Anterior
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                <ChevronLeft aria-hidden="true" />
                Anterior
              </Button>
            )}
          </PaginationItem>

          {pageWindow(current, last).map((page, index) =>
            page === "gap" ? (
              <PaginationItem key={`gap-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={page}>
                <Button
                  asChild
                  variant={page === current ? "outline" : "ghost"}
                  size="icon"
                  className="tabular-nums"
                >
                  <Link
                    href={href((page - 1) * pageSize)}
                    aria-current={page === current ? "page" : undefined}
                  >
                    {page}
                  </Link>
                </Button>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            {current < last ? (
              <Button asChild variant="ghost" size="sm">
                <Link href={href(current * pageSize)} aria-label="Pagina siguiente">
                  Siguiente
                  <ChevronRight aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button variant="ghost" size="sm" disabled>
                Siguiente
                <ChevronRight aria-hidden="true" />
              </Button>
            )}
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
