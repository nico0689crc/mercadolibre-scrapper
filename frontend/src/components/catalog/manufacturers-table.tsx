import { ExternalLink } from "lucide-react";

import { ManufacturerStatusBadge } from "@/components/catalog/manufacturer-status-badge";
import { HeaderHint } from "@/components/catalog/sort-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { count } from "@/lib/format";
import type { Manufacturer } from "@/types/api";

/** Fabricantes del segmento, con el porque de cada uno a la vista. */
export function ManufacturersTable({ items }: { items: Manufacturer[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Marca</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead className="text-right">
            <HeaderHint
              label="Modelos"
              hint="Codigos de modelo distintos dentro del segmento. Es la señal que separa fabricante de revendedor."
            />
          </TableHead>
          <TableHead className="text-right">Productos</TableHead>
          <TableHead>Dominio oficial</TableHead>
          <TableHead>Por que</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((m) => (
          <TableRow key={m.brandId}>
            <TableCell className="font-medium">
              {m.name}
              {m.mlValueId ? (
                <span className="text-muted-foreground ml-2 font-mono text-xs">
                  {m.mlValueId}
                </span>
              ) : null}
            </TableCell>
            <TableCell>
              <ManufacturerStatusBadge status={m.status} />
            </TableCell>
            <TableCell className="text-right font-medium tabular-nums">
              {count(m.models)}
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {count(m.products)}
            </TableCell>
            <TableCell>
              {m.officialDomains.length > 0 ? (
                <a
                  className="inline-flex items-center gap-1 hover:underline"
                  href={`https://${m.officialDomains[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {m.officialDomains[0]}
                  <ExternalLink className="size-3" aria-hidden="true" />
                </a>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground max-w-md text-sm text-pretty">
              {m.notes ?? "Paso el umbral automatico; falta curarla a mano."}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
