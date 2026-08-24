import Link from "next/link";

import { CategoryCascade } from "@/components/catalog/category-cascade";
import {
  FilterBar,
  FilterField,
  FilterGroup,
  TristateField,
  type ActiveFilter,
} from "@/components/catalog/filter-bar";
import { FilterSelect } from "@/components/catalog/filter-select";
import { PaginationNav } from "@/components/catalog/pagination-nav";
import { ProductsTable } from "@/components/catalog/products-table";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { getCategoryTree, getDomains, getProducts } from "@/lib/api";
import { categoryId, one, oneOf, positive, text, without } from "@/lib/filters";
import { count } from "@/lib/format";
import type {
  CategoryNode,
  DomainOption,
  ProductList,
  ProductSort,
  ProductStatus,
  SortDir,
  Tristate,
} from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const BASE = "/products";
const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Productos" }];
const SORTS: ProductSort[] = ["name", "brand", "category", "lastSeenAt"];
const DIRS: SortDir[] = ["asc", "desc"];
const TRISTATES: Tristate[] = ["any", "yes", "no"];
const STATUSES: ProductStatus[] = ["active", "inactive"];

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const params = await searchParams;

  // categoryId y brandId no se editan en la barra: llegan de un link y se
  // conservan como chips.
  const category = categoryId(params.categoryId);
  const brandId = one(params.brandId);
  const branch = categoryId(params.branch);
  const search = one(params.q);
  const domainId = text(params.domainId);
  const status = STATUSES.find((option) => option === one(params.status));
  const brand = one(params.brand) === "none" ? "none" : "any";
  const photo = oneOf(params.photo, TRISTATES, "any");
  const sort = oneOf(params.sort, SORTS, "name");
  const dir = oneOf(params.dir, DIRS, "asc");
  const offset = positive(params.offset) ?? 0;

  let data: ProductList;
  let domains: DomainOption[];
  let tree: CategoryNode[];
  try {
    [data, domains, tree] = await Promise.all([
      getProducts({
        categoryId: category,
        branch,
        brandId,
        search,
        domainId,
        status,
        brand,
        photo,
        sort,
        dir,
        limit: PAGE_SIZE,
        offset,
      }),
      // Los dominios que existen dentro del recorte actual.
      getDomains({ categoryId: category, branch }),
      getCategoryTree(),
    ]);
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

  const branchName = tree.find((node) => node.id === branch)?.name ?? branch;
  // Todos los productos de la pagina comparten el filtro, asi que el primero
  // alcanza para ponerle nombre al chip sin pedirle nada mas al backend.
  const categoryName = data.items[0]?.categoryName ?? category;
  const brandName = data.items[0]?.brandName ?? brandId;

  const filters: Record<string, string> = {
    ...(category ? { categoryId: category } : {}),
    ...(brandId ? { brandId } : {}),
    ...(branch ? { branch } : {}),
    ...(search ? { q: search } : {}),
    ...(domainId ? { domainId } : {}),
    ...(status ? { status } : {}),
    ...(brand === "none" ? { brand } : {}),
    ...(photo !== "any" ? { photo } : {}),
  };
  const withSort = { ...filters, sort, dir };

  const labels: Record<string, string> = {
    categoryId: `Categoria: ${categoryName}`,
    brandId: `Marca: ${brandName}`,
    branch: `Rama: ${branchName}`,
    q: `Texto: ${search}`,
    domainId: `Dominio: ${domainId}`,
    status: status === "active" ? "Activos" : "Inactivos",
    brand: "Sin marca",
    photo: photo === "yes" ? "Con foto" : "Sin foto",
  };

  const chips: ActiveFilter[] = Object.keys(filters).map((key) => ({
    key,
    label: labels[key],
    href: without(BASE, withSort, key),
  }));

  // Si el dominio filtrado no entro en el top del recorte, igual tiene que
  // seguir seleccionado en el combo.
  const domainOptions =
    domainId && !domains.some((option) => option.domainId === domainId)
      ? [{ domainId, products: 0 }, ...domains]
      : domains;

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Productos"
        description="Productos de catalogo guardados durante los scans. Todos los filtros se combinan entre si."
        meta={
          <Badge variant="secondary" className="tabular-nums">
            {count(data.total)} productos
          </Badge>
        }
      />

      <FilterBar
        basePath={BASE}
        keep={{
          sort,
          dir,
          ...(category ? { categoryId: category } : {}),
          ...(brandId ? { brandId } : {}),
        }}
        chips={chips}
      >
        <FilterGroup label="1 · Donde buscar">
          {/* Con una categoria exacta (viene de un link) la cascada no aplica. */}
          {category ? null : <CategoryCascade nodes={tree} value={branch} />}

          <FilterField
            label="Dominio de catalogo"
            htmlFor="domainId"
            hint={
              category || branch
                ? "Los dominios que existen dentro de lo elegido arriba."
                : "Los 100 dominios con mas productos guardados."
            }
          >
            <FilterSelect
              id="domainId"
              name="domainId"
              defaultValue={domainId ?? "any"}
              options={[
                { value: "any", label: "Todos" },
                ...domainOptions.map((option) => ({
                  value: option.domainId,
                  label: `${option.domainId} (${count(option.products)})`,
                })),
              ]}
            />
          </FilterField>
        </FilterGroup>

        <FilterGroup label="2 · Que productos mostrar">
          <FilterField label="Buscar" htmlFor="q" hint="Coincidencia parcial en el nombre.">
            <Input id="q" name="q" defaultValue={search ?? ""} placeholder="galaxy, notebook…" />
          </FilterField>

          <FilterField label="Estado en ML" htmlFor="status">
            <FilterSelect
              id="status"
              name="status"
              defaultValue={status ?? "any"}
              options={[
                { value: "any", label: "Todos" },
                { value: "active", label: "Activos" },
                { value: "inactive", label: "Inactivos" },
              ]}
            />
          </FilterField>

          {brandId ? null : (
            <FilterField
              label="Marca"
              htmlFor="brand"
              hint="Los que quedaron sin marca son los que ML publica sin el atributo BRAND."
            >
              <FilterSelect
                id="brand"
                name="brand"
                defaultValue={brand}
                options={[
                  { value: "any", label: "Todas" },
                  { value: "none", label: "Sin marca resuelta" },
                ]}
              />
            </FilterField>
          )}

          <TristateField
            name="photo"
            label="Foto"
            value={photo}
            yes="Con foto"
            no="Sin foto"
            all="Todos"
          />
        </FilterGroup>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>{chips.length > 0 ? "Resultado filtrado" : "Todos los productos"}</CardTitle>
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
                  ? "Ningun producto guardado cumple con estos filtros."
                  : "Corre un scan en alguna categoria para guardar sus productos de catalogo."}
              </EmptyDescription>
            </EmptyHeader>
            {chips.length > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={BASE}>Limpiar filtros</Link>
              </Button>
            ) : null}
          </Empty>
        ) : (
          <ProductsTable items={data.items} params={filters} sort={sort} dir={dir} />
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
