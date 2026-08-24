import Link from "next/link";
import { Search, X } from "lucide-react";

import { PaginationNav } from "@/components/catalog/pagination-nav";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProducts } from "@/lib/api";
import type { ProductList } from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

export default async function ProductsPage({ searchParams }: PageProps<"/products">) {
  const params = await searchParams;
  const categoryId = one(params.categoryId);
  const brandId = one(params.brandId);
  const search = one(params.q);
  const offset = Number(one(params.offset)) > 0 ? Number(one(params.offset)) : 0;

  let data: ProductList;
  try {
    data = await getProducts({ categoryId, brandId, search, limit: PAGE_SIZE, offset });
  } catch (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudieron leer los productos</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : "Error desconocido"}
        </AlertDescription>
      </Alert>
    );
  }

  // Filtros activos, con el link que los quita.
  const active = [
    categoryId ? { key: "categoryId", label: `Categoria ${categoryId}` } : null,
    brandId
      ? { key: "brandId", label: `Marca ${data.items[0]?.brandName ?? brandId.slice(0, 8)}` }
      : null,
  ].filter((f): f is { key: string; label: string } => f !== null);

  const kept = Object.fromEntries(
    [
      categoryId ? ["categoryId", categoryId] : null,
      brandId ? ["brandId", brandId] : null,
      search ? ["q", search] : null,
    ].filter((e): e is [string, string] => e !== null),
  );

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Productos</h1>
        <p className="text-muted-foreground">
          Productos de catalogo guardados durante los scans. Filtrables por marca y categoria.
        </p>
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/products">
        {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
        {brandId ? <input type="hidden" name="brandId" value={brandId} /> : null}
        <div className="grid w-full max-w-sm gap-2">
          <Label htmlFor="q">Buscar en el nombre</Label>
          <Input id="q" name="q" defaultValue={search ?? ""} placeholder="galaxy, notebook…" />
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>

      {active.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {active.map((filter) => {
            const rest = Object.fromEntries(
              Object.entries(kept).filter(([k]) => k !== filter.key),
            );
            return (
              <Badge key={filter.key} variant="secondary" asChild>
                <Link href={`/products?${new URLSearchParams(rest)}`}>
                  {filter.label}
                  <X className="size-3" aria-hidden="true" />
                  <span className="sr-only">Quitar filtro</span>
                </Link>
              </Badge>
            );
          })}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{data.total.toLocaleString("es-AR")} productos</CardTitle>
          <CardDescription>Ordenados por nombre.</CardDescription>
        </CardHeader>
        {data.items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin resultados</EmptyTitle>
              <EmptyDescription>
                Corre un scan en alguna categoria para guardar sus productos de catalogo.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Producto</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/products/${product.id}`}>
                        {product.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {product.brandId ? (
                        <Link
                          className="hover:underline"
                          href={`/products?brandId=${product.brandId}`}
                        >
                          {product.brandName}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.categoryId ? (
                        <Link
                          className="hover:underline"
                          href={`/categories/${product.categoryId}`}
                        >
                          {product.categoryName ?? product.categoryId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {product.id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <PaginationNav
        basePath="/products"
        params={kept}
        offset={offset}
        pageSize={PAGE_SIZE}
        total={data.total}
      />
    </div>
  );
}
