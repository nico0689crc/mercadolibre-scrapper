"use client";

import { LocalTable, type LocalColumn } from "@/components/catalog/local-table";
import type { ProductAttribute } from "@/types/api";

const COLUMNS: LocalColumn<ProductAttribute>[] = [
  {
    key: "name",
    header: "Atributo",
    sortValue: (attribute) => attribute.name,
    cell: (attribute) => (
      <div className="flex flex-col">
        <span className="font-medium">{attribute.name}</span>
        <span className="text-muted-foreground font-mono text-xs">{attribute.id}</span>
      </div>
    ),
  },
  {
    key: "value",
    header: "Valor",
    sortValue: (attribute) => attribute.value_name ?? "",
    cell: (attribute) => attribute.value_name ?? <span className="text-muted-foreground">—</span>,
  },
];

export function AttributesTable({ attributes }: { attributes: ProductAttribute[] }) {
  return (
    <LocalTable
      rows={attributes}
      columns={COLUMNS}
      rowKey={(attribute) => attribute.id}
      placeholder="Filtrar atributo…"
      filter={(attribute, query) =>
        attribute.name.toLowerCase().includes(query) ||
        (attribute.value_name ?? "").toLowerCase().includes(query)
      }
      emptyTitle="Sin atributos guardados"
      emptyDescription="Corre un scan de su categoria para traerlos."
    />
  );
}
