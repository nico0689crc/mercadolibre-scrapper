import Link from "next/link";

import { StatCard } from "@/components/catalog/stat-card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getScans, getStats } from "@/lib/api";
import type { CatalogStats, ScanRun } from "@/types/api";

export const dynamic = "force-dynamic";

async function load(): Promise<
  { ok: true; stats: CatalogStats; scans: ScanRun[] } | { ok: false; error: string }
> {
  try {
    const [stats, scans] = await Promise.all([getStats(), getScans(10)]);
    return { ok: true, stats, scans };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export default async function Home() {
  const data = await load();

  if (!data.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo contactar al backend</AlertTitle>
        <AlertDescription>{data.error}</AlertDescription>
      </Alert>
    );
  }

  const { stats, scans } = data;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
        <p className="text-muted-foreground">
          Marcas del catalogo de Mercado Libre acumuladas por categoria.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Categorias" value={stats.categories} hint="Sincronizadas desde ML" />
        <StatCard label="Marcas" value={stats.brands} hint="Distintas, deduplicadas" />
        <StatCard label="Productos" value={stats.products} hint="De catalogo, con su marca" />
        <StatCard label="Scans" value={stats.scans} hint="Peticiones registradas" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Ultimos scans</CardTitle>
          <CardDescription>Cada corrida contra la API de ML y lo que aporto.</CardDescription>
        </CardHeader>
        {scans.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Todavia no hay scans</EmptyTitle>
              <EmptyDescription>
                Entra a una categoria y corre un scan para empezar a juntar marcas.
              </EmptyDescription>
            </EmptyHeader>
            <Button asChild size="sm">
              <Link href="/categories">Ver categorias</Link>
            </Button>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Analizados</TableHead>
                  <TableHead className="text-right">Marcas</TableHead>
                  <TableHead className="text-right">Nuevas</TableHead>
                  <TableHead className="text-right">Productos</TableHead>
                  <TableHead className="text-right">Duracion</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scans.map((scan) => (
                  <TableRow key={scan.id}>
                    <TableCell>
                      <Link className="hover:underline" href={`/categories/${scan.categoryId}`}>
                        {scan.categoryId}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={scan.status === "ok" ? "secondary" : "destructive"}>
                        {scan.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {scan.sampled.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{scan.brandsFound}</TableCell>
                    <TableCell className="text-right tabular-nums">{scan.brandsNew}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {scan.productsStored.toLocaleString("es-AR")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {(scan.durationMs / 1000).toFixed(1)}s
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
