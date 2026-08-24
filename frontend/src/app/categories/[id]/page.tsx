import Link from "next/link";
import { notFound } from "next/navigation";
import { Package } from "lucide-react";

import { CategoryBrandsTable } from "@/components/catalog/category-brands-table";
import { CategoryTable } from "@/components/catalog/category-table";
import { ScanButton } from "@/components/catalog/scan-button";
import { StatCard } from "@/components/catalog/stat-card";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, getCategory } from "@/lib/api";
import { relative } from "@/lib/format";
import type { CategoryWithBrands } from "@/types/api";

export const dynamic = "force-dynamic";

const BASE_CRUMBS = [
  { href: "/", label: "Resumen" },
  { href: "/categories", label: "Categorias" },
];

async function load(
  id: string,
): Promise<{ ok: true; data: CategoryWithBrands } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await getCategory(id) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export default async function CategoryPage({ params }: PageProps<"/categories/[id]">) {
  const { id } = await params;
  const result = await load(id);

  if (!result.ok) {
    return (
      <PageShell crumbs={[...BASE_CRUMBS, { label: id }]}>
        <Alert variant="destructive">
          <AlertTitle>No se pudo leer la categoria</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const { category, children, brands } = result.data;

  return (
    <PageShell
      crumbs={[
        ...BASE_CRUMBS,
        // `path` es el path_from_root de ML: el ultimo elemento es esta misma
        // categoria, que ya va como pagina actual.
        ...category.path.slice(0, -1).map((step) => ({
          href: `/categories/${step.id}`,
          label: step.name,
        })),
        { label: category.name },
      ]}
    >
      <PageHeader
        title={category.name}
        meta={
          <>
            <Badge variant="outline" className="font-mono text-xs">
              {category.id}
            </Badge>
            {category.catalogDomain ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {category.catalogDomain}
              </Badge>
            ) : null}
            <Badge variant="secondary">nivel {category.depth}</Badge>
            {category.isLeaf ? <Badge variant="secondary">hoja</Badge> : null}
            <span className="text-muted-foreground text-sm">
              sincronizada {relative(category.syncedAt)}
            </span>
          </>
        }
        actions={
          <>
            <Button asChild variant="outline">
              <Link href={`/products?categoryId=${category.id}`}>
                <Package aria-hidden="true" />
                Ver productos
              </Link>
            </Button>
            <ScanButton categoryId={category.id} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Items en ML" value={category.totalItems} hint="Publicaciones declaradas" />
        <StatCard label="Marcas detectadas" value={brands.length} hint="Acumuladas entre scans" />
        <StatCard
          label="Subcategorias"
          value={children.length}
          hint="Hijas directas en el arbol"
        />
      </div>

      <Tabs defaultValue="brands">
        <TabsList>
          <TabsTrigger value="brands">
            Marcas
            <Badge variant="secondary" className="tabular-nums">
              {brands.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="children">
            Subcategorias
            <Badge variant="secondary" className="tabular-nums">
              {children.length}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brands">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Marcas de {category.name}</CardTitle>
              <CardDescription>
                Se acumulan entre scans: una corrida chica no borra la cobertura que consiguio
                una grande. Clickea una marca para ver sus productos en esta categoria.
              </CardDescription>
            </CardHeader>
            <CategoryBrandsTable brands={brands} categoryId={category.id} />
          </Card>
        </TabsContent>

        <TabsContent value="children">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Subcategorias</CardTitle>
              <CardDescription>Hijas directas de {category.name}.</CardDescription>
            </CardHeader>
            {children.length === 0 ? (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>Sin hijas</EmptyTitle>
                  <EmptyDescription>
                    {category.isLeaf
                      ? "Es una categoria hoja: los productos cuelgan directo de aca."
                      : "El arbol se sincronizo hasta este nivel. Corre un sync mas profundo para traerlas."}
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <CategoryTable categories={children} />
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
