import Link from "next/link";

import { BrandsTable } from "@/components/catalog/brands-table";
import { CategoryCascade } from "@/components/catalog/category-cascade";
import {
  FilterBar,
  FilterField,
  FilterGroup,
  type ActiveFilter,
} from "@/components/catalog/filter-bar";
import { PaginationNav } from "@/components/catalog/pagination-nav";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { getBrands, getCategoryTree } from "@/lib/api";
import { categoryId, one, oneOf, positive, without } from "@/lib/filters";
import { count } from "@/lib/format";
import type { BrandList, BrandSort, CategoryNode, SortDir } from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const BASE = "/brands";
const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Marcas" }];
const SORTS: BrandSort[] = ["name", "categories", "products"];
const DIRS: SortDir[] = ["asc", "desc"];

export default async function BrandsPage({ searchParams }: PageProps<"/brands">) {
  const params = await searchParams;

  const search = one(params.q);
  const branch = categoryId(params.branch);
  const minProducts = positive(params.minProducts);
  const minCategories = positive(params.minCategories);
  const sort = oneOf(params.sort, SORTS, "products");
  const dir = oneOf(params.dir, DIRS, "desc");
  const offset = positive(params.offset) ?? 0;

  let data: BrandList;
  let tree: CategoryNode[];
  try {
    [data, tree] = await Promise.all([
      getBrands({
        search,
        branch,
        minProducts,
        minCategories,
        sort,
        dir,
        limit: PAGE_SIZE,
        offset,
      }),
      getCategoryTree(),
    ]);
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

  const branchName = tree.find((node) => node.id === branch)?.name ?? branch;

  const filters: Record<string, string> = {
    ...(search ? { q: search } : {}),
    ...(branch ? { branch } : {}),
    ...(minProducts ? { minProducts: String(minProducts) } : {}),
    ...(minCategories ? { minCategories: String(minCategories) } : {}),
  };
  const withSort = { ...filters, sort, dir };

  const labels: Record<string, string> = {
    q: `Texto: ${search}`,
    branch: `Rama: ${branchName}`,
    minProducts: `Desde ${count(minProducts ?? 0)} productos`,
    minCategories: `En ${count(minCategories ?? 0)}+ categorias`,
  };

  const chips: ActiveFilter[] = Object.keys(filters).map((key) => ({
    key,
    label: labels[key],
    href: without(BASE, withSort, key),
  }));

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

      <FilterBar basePath={BASE} keep={{ sort, dir }} chips={chips}>
        <FilterGroup label="1 · Donde buscar">
          <CategoryCascade nodes={tree} value={branch} />
        </FilterGroup>

        <FilterGroup label="2 · Que marcas mostrar">
          <FilterField label="Buscar" htmlFor="q" hint="Coincidencia parcial en el nombre.">
            <Input id="q" name="q" defaultValue={search ?? ""} placeholder="Samsung, Motorola…" />
          </FilterField>

          <FilterField
            label="Minimo de productos"
            htmlFor="minProducts"
            hint="Sirve para sacarse de encima la cola de marcas basura."
          >
            <Input
              id="minProducts"
              name="minProducts"
              type="number"
              min="1"
              defaultValue={minProducts ?? ""}
              placeholder="10"
            />
          </FilterField>

          <FilterField
            label="Minimo de categorias"
            htmlFor="minCategories"
            hint="Marcas transversales a varios rubros."
          >
            <Input
              id="minCategories"
              name="minCategories"
              type="number"
              min="1"
              defaultValue={minCategories ?? ""}
              placeholder="3"
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{chips.length > 0 ? "Resultado filtrado" : "Todas las marcas"}</CardTitle>
          <CardDescription>
            Clickea una cabecera para reordenar todo el resultado, no solo esta pagina.
          </CardDescription>
        </CardHeader>

        {data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                {chips.length > 0
                  ? "Ninguna marca cumple con estos filtros."
                  : "Corre un scan en alguna categoria para empezar a juntar marcas."}
              </EmptyDescription>
            </EmptyHeader>
            {chips.length > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={BASE}>Limpiar filtros</Link>
              </Button>
            ) : null}
          </Empty>
        ) : (
          <BrandsTable items={data.items} params={filters} sort={sort} dir={dir} />
        )}
      </Card>

      <PaginationNav
        basePath={BASE}
        params={withSort}
        offset={offset}
        pageSize={PAGE_SIZE}
        total={data.total}
      />
    </PageShell>
  );
}
