"use client";

import Link from "next/link";

import { LocalTable, type LocalColumn } from "@/components/catalog/local-table";
import { Progress } from "@/components/ui/progress";
import type { StoredBrand } from "@/types/api";

/**
 * Marcas acumuladas de una categoria. La barra compara cada marca con la que
 * mas productos junto en esta categoria: sirve para ver de un vistazo quien
 * domina el catalogo, no es un porcentaje del total de ML.
 */
export function CategoryBrandsTable({
  brands,
  categoryId,
}: {
  brands: StoredBrand[];
  categoryId: string;
}) {
  const top = Math.max(1, ...brands.map((brand) => brand.productsMax));

  const columns: LocalColumn<StoredBrand>[] = [
    {
      key: "name",
      header: "Marca",
      sortValue: (brand) => brand.name,
      cell: (brand) => (
        <div className="flex flex-col">
          <Link
            className="font-medium hover:underline"
            href={`/products?brandId=${brand.id}&branch=${categoryId}`}
          >
            {brand.name}
          </Link>
          <span className="text-muted-foreground font-mono text-xs">
            {brand.mlValueId ? `ML ${brand.mlValueId}` : "sin id de ML"}
          </span>
        </div>
      ),
    },
    {
      key: "productsMax",
      header: "Cobertura",
      hint: "Maximo historico de productos vistos con esta marca en la categoria, comparado con la marca mas grande.",
      sortValue: (brand) => brand.productsMax,
      cell: (brand) => (
        <div className="flex items-center gap-3">
          <Progress value={(brand.productsMax / top) * 100} className="max-w-32" />
          <span className="tabular-nums">{brand.productsMax.toLocaleString("es-AR")}</span>
        </div>
      ),
    },
    {
      key: "products",
      header: "Ultimo scan",
      align: "end",
      hint: "Productos con esta marca en la corrida mas reciente.",
      sortValue: (brand) => brand.products,
      cell: (brand) => <span className="tabular-nums">{brand.products.toLocaleString("es-AR")}</span>,
    },
    {
      key: "occurrences",
      header: "Scans",
      align: "end",
      hint: "Cuantas corridas encontraron la marca en esta categoria.",
      sortValue: (brand) => brand.occurrences,
      cell: (brand) => (
        <span className="text-muted-foreground tabular-nums">{brand.occurrences}</span>
      ),
    },
  ];

  return (
    <LocalTable
      rows={brands}
      columns={columns}
      rowKey={(brand) => brand.id}
      defaultSort={{ key: "productsMax", dir: "desc" }}
      placeholder="Filtrar marca…"
      filter={(brand, query) => brand.name.toLowerCase().includes(query)}
      emptyTitle="Sin marcas todavia"
      emptyDescription="Corre un scan para traer las marcas de esta categoria desde el catalogo de ML."
    />
  );
}
