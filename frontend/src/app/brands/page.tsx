import Link from "next/link";
import { Search } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { getBrands } from "@/lib/api";
import type { BrandList } from "@/types/api";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

async function load(
  search: string | undefined,
  offset: number,
): Promise<{ ok: true; data: BrandList } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await getBrands({ limit: PAGE_SIZE, offset, search }) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export default async function BrandsPage({ searchParams }: PageProps<"/brands">) {
  const params = await searchParams;
  const search = typeof params.q === "string" && params.q ? params.q : undefined;
  const offset = Number(params.offset) > 0 ? Number(params.offset) : 0;

  const result = await load(search, offset);

  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudieron leer las marcas</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  const { total, items } = result.data;
  const hasPrev = offset > 0;
  const hasNext = offset + PAGE_SIZE < total;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Marcas</h1>
        <p className="text-muted-foreground">
          Todas las marcas detectadas, con en cuantas categorias aparece cada una.
        </p>
      </div>

      <form className="flex items-end gap-2" action="/brands">
        <div className="grid w-full max-w-sm gap-2">
          <Label htmlFor="q">Buscar marca</Label>
          <Input id="q" name="q" defaultValue={search ?? ""} placeholder="Samsung, Motorola…" />
        </div>
        <Button type="submit" variant="secondary">
          <Search aria-hidden="true" />
          Buscar
        </Button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>{total.toLocaleString("es-AR")} marcas</CardTitle>
          <CardDescription>
            {search ? `Filtradas por "${search}". ` : ""}
            Ordenadas por productos acumulados.
          </CardDescription>
        </CardHeader>

        {items.length === 0 ? (
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Id en ML</TableHead>
                  <TableHead className="text-right">Categorias</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((brand) => (
                  <TableRow key={brand.id}>
                    <TableCell className="font-medium">
                      <Link className="hover:underline" href={`/products?brandId=${brand.id}`}>
                        {brand.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {brand.mlValueId ?? "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{brand.categories}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {brand.products.toLocaleString("es-AR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm tabular-nums">
          {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total.toLocaleString("es-AR")}
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm" disabled={!hasPrev}>
            <a
              href={`/brands?${new URLSearchParams({
                ...(search ? { q: search } : {}),
                offset: String(Math.max(0, offset - PAGE_SIZE)),
              })}`}
            >
              Anterior
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" disabled={!hasNext}>
            <a
              href={`/brands?${new URLSearchParams({
                ...(search ? { q: search } : {}),
                offset: String(offset + PAGE_SIZE),
              })}`}
            >
              Siguiente
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
