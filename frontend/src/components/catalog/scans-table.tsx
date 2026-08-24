import Link from "next/link";

import { HeaderHint } from "@/components/catalog/sort-header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { count, relative, seconds } from "@/lib/format";
import type { ScanRun } from "@/types/api";

/** Bitacora de las ultimas corridas contra la API de ML. */
export function ScansTable({ scans }: { scans: ScanRun[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Categoria</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">
            <HeaderHint
              label="Analizados"
              hint="Productos de catalogo que devolvio la corrida."
            />
          </TableHead>
          <TableHead className="text-right">
            <HeaderHint label="Marcas" hint="Marcas encontradas, y cuantas eran nuevas." />
          </TableHead>
          <TableHead className="text-right">Productos</TableHead>
          <TableHead className="text-right">Duracion</TableHead>
          <TableHead className="text-right">Cuando</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {scans.map((scan) => (
          <TableRow key={scan.id}>
            <TableCell>
              <Link
                className="font-mono text-xs font-medium hover:underline"
                href={`/categories/${scan.categoryId}`}
              >
                {scan.categoryId}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant={scan.status === "ok" ? "secondary" : "destructive"}>
                {scan.status}
              </Badge>
            </TableCell>
            <TableCell className="text-right tabular-nums">{count(scan.sampled)}</TableCell>
            <TableCell className="text-right tabular-nums">
              {scan.brandsFound}
              {scan.brandsNew > 0 ? (
                <span className="text-muted-foreground"> (+{scan.brandsNew})</span>
              ) : null}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {count(scan.productsStored)}
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {seconds(scan.durationMs)}
            </TableCell>
            <TableCell className="text-muted-foreground text-right text-sm">
              {relative(scan.createdAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
