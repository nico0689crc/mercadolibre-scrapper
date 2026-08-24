import Link from "next/link";
import { X } from "lucide-react";

import { PaginationNav } from "@/components/catalog/pagination-nav";
import { ProductsTable } from "@/components/catalog/products-table";
import { SearchForm } from "@/components/catalog/search-form";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getProducts } from "@/lib/api";
import { count } from "@/lib/format";
import type { ProductList, ProductSort, SortDir } from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Productos" }];
const SORTS: ProductSort[] = ["name", "brand", "category", "lastSeenAt"];

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const params = await searchParams;
  const categoryId = one(params.categoryId);
  const brandId = one(params.brandId);
  const search = one(params.q);
  const offset = Number(one(params.offset)) > 0 ? Number(one(params.offset)) : 0;
  const sort = SORTS.find((s) => s === one(params.sort)) ?? "name";
  const dir: SortDir = one(params.dir) === "desc" ? "desc" : "asc";

  let data: ProductList;
  try {
    data = await getProducts({
      categoryId,
      brandId,
      search,
      limit: PAGE_SIZE,
      offset,
      sort,
      dir,
    });
  } catch (error) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudieron leer los productos</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Error desconocido"}
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const filters: Record<string, string> = {
    ...(categoryId ? { categoryId } : {}),
    ...(brandId ? { brandId } : {}),
    ...(search ? { q: search } : {}),
  };

  // Todos los productos de la pagina comparten el filtro, asi que el primero
  // alcanza para ponerle nombre al chip sin pedirle nada mas al backend.
  const chips = [
    categoryId
      ? {
          key: "categoryId",
          label: `Categoria: ${data.items[0]?.categoryName ?? categoryId}`,
        }
      : null,
    brandId ? { key: "brandId", label: `Marca: ${data.items[0]?.brandName ?? brandId}` } : null,
    search ? { key: "q", label: `Busqueda: ${search}` } : null,
  ].filter((chip): chip is { key: string; label: string } => chip !== null);

  const withoutFilter = (key: string) => {
    const rest = Object.fromEntries(Object.entries(filters).filter(([k]) => k !== key));
    return `/products?${new URLSearchParams({ ...rest, sort, dir })}`;
  };

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Productos"
        description="Productos de catalogo guardados durante los scans. Se pueden combinar marca, categoria y texto."
        meta={
          <Badge variant="secondary" className="tabular-nums">
            {count(data.total)} productos
          </Badge>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchForm
          action="/products"
          hidden={{ ...(categoryId ? { categoryId } : {}), ...(brandId ? { brandId } : {}), sort, dir }}
          defaultValue={search}
          placeholder="Buscar en el nombre…"
        />

        {chips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {chips.map((chip) => (
              <Badge key={chip.key} variant="secondary" asChild>
                <Link href={withoutFilter(chip.key)}>
                  {chip.label}
                  <X className="size-3" aria-hidden="true" />
                  <span className="sr-only">Quitar filtro</span>
                </Link>
              </Badge>
            ))}
            {chips.length > 1 ? (
              <Button asChild variant="ghost" size="sm">
                <Link href="/products">Limpiar todo</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{chips.length > 0 ? "Resultado filtrado" : "Todos los productos"}</CardTitle>
          <CardDescription>
            Clickea una cabecera para reordenar toda la tabla, no solo esta pagina.
          </CardDescription>
        </CardHeader>

        {data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                {chips.length > 0
                  ? "Ningun producto guardado coincide con estos filtros."
                  : "Corre un scan en alguna categoria para guardar sus productos de catalogo."}
              </EmptyDescription>
            </EmptyHeader>
            {chips.length > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href="/products">Limpiar filtros</Link>
              </Button>
            ) : null}
          </Empty>
        ) : (
          <ProductsTable items={data.items} params={filters} sort={sort} dir={dir} />
        )}
      </Card>

      <PaginationNav
        basePath="/products"
        params={{ ...filters, sort, dir }}
        offset={offset}
        pageSize={PAGE_SIZE}
        total={data.total}
      />
    </PageShell>
  );
}
