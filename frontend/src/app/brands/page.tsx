import Link from "next/link";
import { X } from "lucide-react";

import { BrandsTable } from "@/components/catalog/brands-table";
import { PaginationNav } from "@/components/catalog/pagination-nav";
import { SearchForm } from "@/components/catalog/search-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getBrands } from "@/lib/api";
import { count } from "@/lib/format";
import type { BrandList, BrandSort, SortDir } from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Marcas" }];
const SORTS: BrandSort[] = ["name", "categories", "products"];

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export default async function BrandsPage({ searchParams }: PageProps<"/brands">) {
  const params = await searchParams;
  const search = one(params.q);
  const offset = Number(one(params.offset)) > 0 ? Number(one(params.offset)) : 0;
  const sort = SORTS.find((s) => s === one(params.sort)) ?? "products";
  const dir: SortDir = one(params.dir) === "asc" ? "asc" : "desc";

  let data: BrandList;
  try {
    data = await getBrands({ limit: PAGE_SIZE, offset, search, sort, dir });
  } catch (error) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudieron leer las marcas</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Error desconocido"}
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  // Lo que conserva cada link: el orden no arrastra `offset` (vuelve a la
  // primera pagina) y la busqueda tampoco.
  const filters: Record<string, string> = search ? { q: search } : {};
  const pageParams = { ...filters, sort, dir };

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Marcas"
        description="Todas las marcas detectadas en los scans, con en cuantas categorias aparece cada una."
        meta={
          <Badge variant="secondary" className="tabular-nums">
            {count(data.total)} marcas
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm
          action="/brands"
          hidden={{ sort, dir }}
          defaultValue={search}
          placeholder="Buscar marca…"
        />
        {search ? (
          <Badge variant="secondary" asChild>
            <Link href="/brands">
              Busqueda: {search}
              <X className="size-3" aria-hidden="true" />
              <span className="sr-only">Quitar la busqueda</span>
            </Link>
          </Badge>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            {search ? `Coinciden con “${search}”` : "Todas las marcas"}
          </CardTitle>
          <CardDescription>
            Clickea una cabecera para reordenar toda la tabla, no solo esta pagina.
          </CardDescription>
        </CardHeader>

        {data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                {search
                  ? "Ninguna marca coincide con la busqueda."
                  : "Corre un scan en alguna categoria para empezar a juntar marcas."}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <BrandsTable items={data.items} params={filters} sort={sort} dir={dir} />
        )}
      </Card>

      <PaginationNav
        basePath="/brands"
        params={pageParams}
        offset={offset}
        pageSize={PAGE_SIZE}
        total={data.total}
      />
    </PageShell>
  );
}
