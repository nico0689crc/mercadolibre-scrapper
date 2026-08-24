"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { LocalTable, type LocalColumn } from "@/components/catalog/local-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Category } from "@/types/api";

const COLUMNS: LocalColumn<Category>[] = [
  {
    key: "name",
    header: "Categoria",
    sortValue: (category) => category.name,
    cell: (category) => (
      <div className="flex flex-col">
        <Link className="font-medium hover:underline" href={`/categories/${category.id}`}>
          {category.name}
        </Link>
        <span className="text-muted-foreground font-mono text-xs">{category.id}</span>
      </div>
    ),
  },
  {
    key: "domain",
    header: "Dominio de catalogo",
    hint: "El domain_id con el que se filtra /products/search. Sin dominio el scan sale mas ruidoso.",
    sortValue: (category) => category.catalogDomain ?? "",
    cell: (category) =>
      category.catalogDomain ? (
        <Badge variant="outline" className="font-mono text-xs">
          {category.catalogDomain}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-sm">sin dominio</span>
      ),
  },
  {
    key: "items",
    header: "Items en ML",
    align: "end",
    hint: "Publicaciones que Mercado Libre declara para la categoria.",
    sortValue: (category) => category.totalItems,
    cell: (category) => (
      <span className="tabular-nums">{category.totalItems.toLocaleString("es-AR")}</span>
    ),
  },
  {
    key: "open",
    header: "",
    align: "end",
    cell: (category) => (
      <Button asChild variant="ghost" size="icon">
        <Link href={`/categories/${category.id}`}>
          <ChevronRight aria-hidden="true" />
          <span className="sr-only">Abrir {category.name}</span>
        </Link>
      </Button>
    ),
  },
];

export function CategoryTable({ categories }: { categories: Category[] }) {
  return (
    <LocalTable
      rows={categories}
      columns={COLUMNS}
      rowKey={(category) => category.id}
      defaultSort={{ key: "items", dir: "desc" }}
      placeholder="Filtrar por nombre o id…"
      filter={(category, query) =>
        category.name.toLowerCase().includes(query) || category.id.toLowerCase().includes(query)
      }
      emptyTitle="Sin categorias"
      emptyDescription="Sincroniza el arbol de Mercado Libre para verlas aca."
    />
  );
}
