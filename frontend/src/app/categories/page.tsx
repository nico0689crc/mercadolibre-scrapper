import Link from "next/link";

import { CategoriesTable } from "@/components/catalog/categories-table";
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
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { getCategories, getCategoryTree } from "@/lib/api";
import { categoryId, one, oneOf, positive, without } from "@/lib/filters";
import { count } from "@/lib/format";
import type {
  CategoryList,
  CategoryNode,
  CategorySort,
  SortDir,
  Tristate,
} from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;
const BASE = "/categories";
const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Categorias" }];
const SORTS: CategorySort[] = ["name", "items", "depth", "brands", "products"];
const TRISTATES: Tristate[] = ["any", "yes", "no"];
const DIRS: SortDir[] = ["asc", "desc"];
/** `depth` acepta el 0, asi que no sirve el helper de enteros positivos. */
function level(value: string | string[] | undefined): number | undefined {
  const raw = one(value);
  return raw && /^\d+$/.test(raw) ? Number(raw) : undefined;
}

export default async function CategoriesPage({ searchParams }: PageProps<"/categories">) {
  const params = await searchParams;

  const search = one(params.q);
  const scope = oneOf(params.scope, ["roots", "all"] as const, "roots");
  const branch = categoryId(params.branch);
  const depth = level(params.depth);
  const leaf = oneOf(params.leaf, TRISTATES, "any");
  const domain = oneOf(params.domain, TRISTATES, "any");
  const brands = oneOf(params.brands, TRISTATES, "any");
  const minItems = positive(params.minItems);
  const sort = oneOf(params.sort, SORTS, "items");
  const dir = oneOf(params.dir, DIRS, "desc");
  const offset = positive(params.offset) ?? 0;

  let data: CategoryList;
  let tree: CategoryNode[];
  try {
    [data, tree] = await Promise.all([
      getCategories({
        scope,
        branch,
        search,
        depth,
        leaf,
        domain,
        brands,
        minItems,
        sort,
        dir,
        limit: PAGE_SIZE,
        offset,
      }),
      // El arbol entero alimenta la cascada categoria -> subcategoria.
      getCategoryTree(),
    ]);
  } catch (error) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudieron leer las categorias</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Error desconocido"}
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const branchName = tree.find((node) => node.id === branch)?.name ?? branch;
  // Los niveles que existen de verdad en el arbol sincronizado.
  const depths = [...new Set(tree.map((node) => node.depth))].sort((a, b) => a - b);

  // Lo que esta filtrando ahora. El orden va aparte porque los chips y el
  // paginado lo conservan pero no es un filtro.
  const filters: Record<string, string> = {
    ...(search ? { q: search } : {}),
    ...(scope === "all" ? { scope } : {}),
    ...(branch ? { branch } : {}),
    ...(depth !== undefined ? { depth: String(depth) } : {}),
    ...(leaf !== "any" ? { leaf } : {}),
    ...(domain !== "any" ? { domain } : {}),
    ...(brands !== "any" ? { brands } : {}),
    ...(minItems ? { minItems: String(minItems) } : {}),
  };
  const withSort = { ...filters, sort, dir };

  const labels: Record<string, string> = {
    q: `Texto: ${search}`,
    scope: "Todo el arbol",
    branch: `Rama: ${branchName}`,
    depth: `Nivel ${depth}`,
    leaf: leaf === "yes" ? "Solo hojas" : "Solo con hijas",
    domain: domain === "yes" ? "Con dominio" : "Sin dominio",
    brands: brands === "yes" ? "Con marcas" : "Sin marcas",
    minItems: `Desde ${count(minItems ?? 0)} items`,
  };

  const chips: ActiveFilter[] = Object.keys(filters).map((key) => ({
    key,
    label: labels[key],
    href: without(BASE, withSort, key),
  }));

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Categorias"
        description="El arbol de Mercado Libre espejado en la base. Cada fila dice cuantas marcas y productos le conocemos."
        meta={
          <Badge variant="secondary" className="tabular-nums">
            {count(data.total)} categorias
          </Badge>
        }
      />

      <FilterBar basePath={BASE} keep={{ sort, dir }} chips={chips}>
        <FilterGroup label="1 · Donde buscar">
          <CategoryCascade nodes={tree} value={branch} />

          <FilterField
            label="Ambito"
            htmlFor="scope"
            hint="Solo se usa si no elegiste una categoria arriba."
          >
            <FilterSelect
              id="scope"
              name="scope"
              defaultValue={scope}
              options={[
                { value: "roots", label: "Solo raices" },
                { value: "all", label: "Todo el arbol" },
              ]}
            />
          </FilterField>
        </FilterGroup>

        <FilterGroup label="2 · Que categorias mostrar">
          <FilterField label="Buscar" htmlFor="q" hint="Por nombre o por id.">
            <Input id="q" name="q" defaultValue={search ?? ""} placeholder="Celulares, MLA1055…" />
          </FilterField>

          <FilterField label="Nivel" htmlFor="depth">
            <FilterSelect
              id="depth"
              name="depth"
              defaultValue={depth !== undefined ? String(depth) : "any"}
              options={[
                { value: "any", label: "Todos" },
                ...depths.map((value) => ({ value: String(value), label: `Nivel ${value}` })),
              ]}
            />
          </FilterField>

          <TristateField
            name="leaf"
            label="Tipo"
            value={leaf}
            yes="Solo hojas"
            no="Solo con hijas"
          />

          <TristateField
            name="domain"
            label="Dominio de catalogo"
            value={domain}
            yes="Con dominio"
            no="Sin dominio"
            hint="Sin dominio el scan no puede acotar por dominio."
          />

          <TristateField
            name="brands"
            label="Marcas detectadas"
            value={brands}
            yes="Con marcas"
            no="Sin marcas"
            hint="Sin marcas = todavia no se escaneo."
          />

          <FilterField label="Minimo de items" htmlFor="minItems" hint="Publicaciones en ML.">
            <Input
              id="minItems"
              name="minItems"
              type="number"
              min="0"
              step="1000"
              defaultValue={minItems ?? ""}
              placeholder="100000"
            />
          </FilterField>
        </FilterGroup>
      </FilterBar>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>
            {chips.length > 0 ? "Resultado filtrado" : "Categorias raiz"}
          </CardTitle>
          <CardDescription>
            Clickea una cabecera para reordenar todo el resultado, no solo esta pagina.
          </CardDescription>
        </CardHeader>

        {data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                {scope === "roots" && !branch
                  ? "Ninguna raiz cumple con estos filtros. Probá con el ambito en todo el arbol."
                  : "Ninguna categoria cumple con estos filtros."}
              </EmptyDescription>
            </EmptyHeader>
            {chips.length > 0 ? (
              <Button asChild size="sm" variant="outline">
                <Link href={BASE}>Limpiar filtros</Link>
              </Button>
            ) : null}
          </Empty>
        ) : (
          <CategoriesTable items={data.items} params={filters} sort={sort} dir={dir} />
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
