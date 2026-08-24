import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { HeaderHint, SortHeader } from "@/components/catalog/sort-header";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BrandListItem, BrandSort, SortDir } from "@/types/api";

/** Tabla de marcas globales. Ordena y pagina el backend, no el navegador. */
export function BrandsTable({
  items,
  params,
  sort,
  dir,
}: {
  items: BrandListItem[];
  params: Record<string, string>;
  sort: BrandSort;
  dir: SortDir;
}) {
  const header = { basePath: "/brands", params, sort, dir };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader {...header} column="name" label="Marca" />
          <TableHead>
            <HeaderHint
              label="Id en ML"
              hint="El value_id que usa Mercado Libre para la marca. No todas lo tienen."
            />
          </TableHead>
          <SortHeader
            {...header}
            column="categories"
            label="Categorias"
            align="end"
            defaultDir="desc"
            hint="En cuantas categorias distintas se detecto la marca."
          />
          <SortHeader
            {...header}
            column="products"
            label="Productos"
            align="end"
            defaultDir="desc"
            hint="Suma del maximo historico de productos por categoria."
          />
          <TableHead className="text-right" />
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
            <TableCell className="text-right">
              <Button asChild variant="ghost" size="icon">
                <Link href={`/products?brandId=${brand.id}`}>
                  <ChevronRight aria-hidden="true" />
                  <span className="sr-only">Ver productos de {brand.name}</span>
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
