import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CategoryTable } from "@/components/catalog/category-table";
import { ScanButton } from "@/components/catalog/scan-button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, getCategory } from "@/lib/api";
import type { CategoryWithBrands } from "@/types/api";

export const dynamic = "force-dynamic";

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
      <Alert variant="destructive">
        <AlertTitle>No se pudo leer la categoria</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  const { category, children, brands } = result.data;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/categories">Categorias</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {category.path.slice(0, -1).map((step) => (
            // El separador es <li>, igual que el item: van como hermanos, no anidados.
            <Fragment key={step.id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={`/categories/${step.id}`}>{step.name}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{category.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{category.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {category.id}
            </Badge>
            {category.catalogDomain ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {category.catalogDomain}
              </Badge>
            ) : null}
            <span className="text-muted-foreground text-sm tabular-nums">
              {category.totalItems.toLocaleString("es-AR")} items
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/products?categoryId=${category.id}`}>Ver productos</Link>
          </Button>
          <ScanButton categoryId={category.id} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Marcas</CardTitle>
          <CardDescription>
            Acumuladas entre scans. &quot;Pico&quot; es el maximo historico de productos vistos
            con esa marca; &quot;scans&quot; cuantas corridas la encontraron.
          </CardDescription>
        </CardHeader>
        {brands.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin marcas todavia</EmptyTitle>
              <EmptyDescription>
                Corre un scan para traer las marcas de esta categoria desde el catalogo de ML.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Id en ML</TableHead>
                  <TableHead className="text-right">Ultimo scan</TableHead>
                  <TableHead className="text-right">Pico</TableHead>
                  <TableHead className="text-right">Scans</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {brands.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">
                      <Link
                        className="hover:underline"
                        href={`/products?brandId=${brand.id}&categoryId=${category.id}`}
                      >
                        {brand.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {brand.mlValueId ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brand.products}</TableCell>
                    <TableCell className="text-right tabular-nums">{brand.productsMax}</TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {brand.occurrences}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {children.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Subcategorias</CardTitle>
            <CardDescription>{children.length} hijas directas.</CardDescription>
          </CardHeader>
          <CategoryTable categories={children} />
        </Card>
      ) : null}
    </div>
  );
}
