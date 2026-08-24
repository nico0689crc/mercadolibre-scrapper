import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Package } from "lucide-react";

import { SortHeader } from "@/components/catalog/sort-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ProductListItem, ProductSort, SortDir } from "@/types/api";

function seenAt(value: string): string {
  return new Date(value).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

/** Tabla de productos de catalogo. Ordena y pagina el backend. */
export function ProductsTable({
  items,
  params,
  sort,
  dir,
}: {
  items: ProductListItem[];
  params: Record<string, string>;
  sort: ProductSort;
  dir: SortDir;
}) {
  const header = { basePath: "/products", params, sort, dir };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader {...header} column="name" label="Producto" />
          <SortHeader {...header} column="brand" label="Marca" />
          <SortHeader
            {...header}
            column="category"
            label="Categoria"
            hint="Bajo que categoria lo encontro el scan. Puede no ser la categoria canonica de ML."
          />
          <SortHeader
            {...header}
            column="lastSeenAt"
            label="Visto"
            align="end"
            defaultDir="desc"
            hint="Ultima corrida que devolvio este producto."
          />
          <TableHead className="text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((product) => (
          <TableRow key={product.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="bg-muted relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md">
                  {product.thumbnail ? (
                    <Image
                      src={product.thumbnail}
                      alt=""
                      fill
                      sizes="40px"
                      className="object-contain"
                    />
                  ) : (
                    <Package className="text-muted-foreground size-4" aria-hidden="true" />
                  )}
                </div>
                {/* Los nombres del catalogo son larguisimos: una sola linea,
                    con el nombre completo en el tooltip. */}
                <div className="flex min-w-0 max-w-md flex-col">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Link
                        className="block truncate font-medium hover:underline"
                        href={`/products/${product.id}`}
                      >
                        {product.name}
                      </Link>
                    </TooltipTrigger>
                    <TooltipContent>{product.name}</TooltipContent>
                  </Tooltip>
                  <span className="text-muted-foreground font-mono text-xs">{product.id}</span>
                </div>
              </div>
            </TableCell>
            <TableCell>
              {product.brandId ? (
                <Link className="hover:underline" href={`/products?brandId=${product.brandId}`}>
                  {product.brandName}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell>
              {product.categoryId ? (
                <Link className="hover:underline" href={`/categories/${product.categoryId}`}>
                  {product.categoryName ?? product.categoryId}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-right text-sm tabular-nums">
              {seenAt(product.lastSeenAt)}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild variant="ghost" size="icon">
                <Link href={`/products/${product.id}`}>
                  <ChevronRight aria-hidden="true" />
                  <span className="sr-only">Ver {product.name}</span>
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
