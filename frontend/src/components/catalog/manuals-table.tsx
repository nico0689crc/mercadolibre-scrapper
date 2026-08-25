import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { EvidenceBadge } from "@/components/catalog/evidence-badge";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Manual } from "@/types/api";

/** Un PDF por modelo, con el producto que cubre y la evidencia que los ata. */
export function ManualsTable({ items }: { items: Manual[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Marca</TableHead>
          <TableHead>Modelo</TableHead>
          <TableHead>
            <HeaderHint
              label="Producto"
              hint="El producto de catalogo cuyo atributo MODEL coincide con el del manual. Si hay mas de uno, el PDF los cubre a todos: los fabricantes publican un manual por linea."
            />
          </TableHead>
          <TableHead>Evidencia</TableHead>
          <TableHead>Origen</TableHead>
          <TableHead className="text-right">Tamaño</TableHead>
          <TableHead className="text-right">Manual</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((manual) => (
          <TableRow key={manual.id}>
            <TableCell className="font-medium">{manual.brand}</TableCell>
            <TableCell className="font-mono text-xs">
              {manual.modelRaw}
            </TableCell>
            <TableCell className="max-w-xs">
              {manual.productId ? (
                <div className="flex items-center gap-2">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        className="block truncate hover:underline"
                        href={`/products/${manual.productId}`}
                      >
                        {manual.productName}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>{manual.productName}</TooltipContent>
                  </Tooltip>
                  {manual.productCount > 1 ? (
                    <Badge variant="outline" className="tabular-nums">
                      +{manual.productCount - 1}
                    </Badge>
                  ) : null}
                </div>
              ) : (
                <span className="text-muted-foreground">Sin producto</span>
              )}
            </TableCell>
            <TableCell>
              <EvidenceBadge reason={manual.matchReason} />
            </TableCell>
            <TableCell className="text-muted-foreground">
              {manual.sourceDomain}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {manual.bytes ? `${Math.round(manual.bytes / 1024)} KB` : "—"}
            </TableCell>
            <TableCell className="text-right">
              <a
                href={manual.url}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-1 hover:underline"
              >
                Abrir
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
