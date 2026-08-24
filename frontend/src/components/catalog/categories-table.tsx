import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { HeaderHint, SortHeader } from "@/components/catalog/sort-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { count } from "@/lib/format";
import type { CategoryListItem, CategorySort, SortDir } from "@/types/api";

/** Tabla del arbol de categorias. Filtra, ordena y pagina el backend. */
export function CategoriesTable({
  items,
  params,
  sort,
  dir,
}: {
  items: CategoryListItem[];
  params: Record<string, string>;
  sort: CategorySort;
  dir: SortDir;
}) {
  const header = { basePath: "/categories", params, sort, dir };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortHeader {...header} column="name" label="Categoria" />
          <TableHead>
            <HeaderHint
              label="Dominio"
              hint="El catalog_domain con el que el scan acota /products/search. Sin dominio el resultado sale mas ruidoso."
            />
          </TableHead>
          <SortHeader {...header} column="depth" label="Nivel" align="end" />
          <SortHeader
            {...header}
            column="items"
            label="Items en ML"
            align="end"
            defaultDir="desc"
            hint="Publicaciones que Mercado Libre declara para la categoria."
          />
          <SortHeader
            {...header}
            column="brands"
            label="Marcas"
            align="end"
            defaultDir="desc"
            hint="Marcas distintas que los scans ya encontraron aca."
          />
          <SortHeader
            {...header}
            column="products"
            label="Productos"
            align="end"
            defaultDir="desc"
            hint="Productos guardados cuya ultima aparicion fue en esta categoria. Una raiz suele tener 0: los productos quedan en la hoja donde los vio el scan."
          />
          <TableHead className="text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((category) => (
          <TableRow key={category.id}>
            <TableCell>
              <div className="flex flex-col">
                <span className="flex items-center gap-2">
                  <Link
                    className="font-medium hover:underline"
                    href={`/categories/${category.id}`}
                  >
                    {category.name}
                  </Link>
                  {category.isLeaf ? <Badge variant="secondary">hoja</Badge> : null}
                </span>
                <span className="text-muted-foreground font-mono text-xs">
                  {category.id}
                </span>
              </div>
            </TableCell>
            <TableCell>
              {category.catalogDomain ? (
                <Badge variant="outline" className="font-mono text-xs">
                  {category.catalogDomain}
                </Badge>
              ) : (
                <span className="text-muted-foreground text-sm">sin dominio</span>
              )}
            </TableCell>
            <TableCell className="text-muted-foreground text-right tabular-nums">
              {category.depth}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {count(category.totalItems)}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {category.brandsCount > 0 ? (
                <Link
                  className="hover:underline"
                  href={`/categories/${category.id}`}
                >
                  {count(category.brandsCount)}
                </Link>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-right tabular-nums">
              {category.productsCount > 0 ? (
                <Link
                  className="hover:underline"
                  href={`/products?branch=${category.id}`}
                >
                  {count(category.productsCount)}
                </Link>
              ) : (
                <span className="text-muted-foreground">0</span>
              )}
            </TableCell>
            <TableCell className="text-right">
              <Button asChild variant="ghost" size="icon">
                <Link href={`/categories/${category.id}`}>
                  <ChevronRight aria-hidden="true" />
                  <span className="sr-only">Abrir {category.name}</span>
                </Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
