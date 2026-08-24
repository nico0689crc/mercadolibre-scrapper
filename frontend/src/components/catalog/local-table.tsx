"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface LocalColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Si esta, la columna se puede ordenar clickeando la cabecera. */
  sortValue?: (row: T) => string | number;
  align?: "end";
  /** Explicacion de la columna, en un tooltip sobre la cabecera. */
  hint?: string;
}

type Sort = { key: string; dir: "asc" | "desc" };

/**
 * Tabla para listas que ya vienen completas en la pagina (las hijas de una
 * categoria, las marcas de una categoria, los atributos de un producto):
 * filtra y ordena en el cliente, sin volver al servidor. Las listas paginadas
 * por el backend usan SortHeader + PaginationNav en su lugar.
 */
export function LocalTable<T>({
  rows,
  columns,
  rowKey,
  filter,
  placeholder = "Filtrar…",
  defaultSort,
  emptyTitle,
  emptyDescription,
}: {
  rows: T[];
  columns: LocalColumn<T>[];
  rowKey: (row: T) => string;
  filter?: (row: T, query: string) => boolean;
  placeholder?: string;
  defaultSort?: Sort;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort | null>(defaultSort ?? null);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle && filter ? rows.filter((row) => filter(row, needle)) : rows;

    if (!sort) return filtered;

    const sortValue = columns.find((c) => c.key === sort.key)?.sortValue;
    if (!sortValue) return filtered;

    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = sortValue(a);
      const right = sortValue(b);
      if (typeof left === "number" && typeof right === "number") {
        return (left - right) * factor;
      }
      return String(left).localeCompare(String(right), "es") * factor;
    });
  }, [rows, columns, query, sort, filter]);

  const toggle = (key: string) =>
    setSort((current) =>
      current?.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );

  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-3">
      {filter ? (
        <div className="flex flex-wrap items-center justify-between gap-2 px-6">
          <InputGroup className="max-w-xs">
            <InputGroupAddon>
              <Search aria-hidden="true" />
            </InputGroupAddon>
            <InputGroupInput
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
            />
            {query ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" onClick={() => setQuery("")}>
                  <X aria-hidden="true" />
                  <span className="sr-only">Limpiar filtro</span>
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          <p className="text-muted-foreground text-sm tabular-nums">
            {visible.length === rows.length
              ? `${rows.length.toLocaleString("es-AR")} filas`
              : `${visible.length.toLocaleString("es-AR")} de ${rows.length.toLocaleString("es-AR")}`}
          </p>
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => {
              const active = sort?.key === column.key ? sort : null;
              const Icon = !active
                ? ChevronsUpDown
                : active.dir === "asc"
                  ? ArrowUp
                  : ArrowDown;

              const label = column.hint ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="underline decoration-dotted underline-offset-4">
                      {column.header}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{column.hint}</TooltipContent>
                </Tooltip>
              ) : (
                column.header
              );

              return (
                <TableHead
                  key={column.key}
                  className={column.align === "end" ? "text-right" : undefined}
                  aria-sort={
                    active ? (active.dir === "asc" ? "ascending" : "descending") : undefined
                  }
                >
                  {column.sortValue ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={column.align === "end" ? "ml-auto" : undefined}
                      onClick={() => toggle(column.key)}
                    >
                      {label}
                      <Icon aria-hidden="true" className={active ? undefined : "opacity-50"} />
                    </Button>
                  ) : (
                    label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="text-muted-foreground h-24 text-center">
                Nada coincide con “{query}”.
              </TableCell>
            </TableRow>
          ) : (
            visible.map((row) => (
              <TableRow key={rowKey(row)}>
                {columns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={column.align === "end" ? "text-right" : undefined}
                  >
                    {column.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
