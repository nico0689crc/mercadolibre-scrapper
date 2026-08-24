import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Category } from "@/types/api";

export function CategoryTable({ categories }: { categories: Category[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Categoria</TableHead>
            <TableHead>Id</TableHead>
            <TableHead>Dominio de catalogo</TableHead>
            <TableHead className="text-right">Items</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {categories.map((category) => (
            <TableRow key={category.id}>
              <TableCell className="font-medium">
                <Link className="hover:underline" href={`/categories/${category.id}`}>
                  {category.name}
                </Link>
              </TableCell>
              <TableCell className="text-muted-foreground font-mono text-xs">
                {category.id}
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
              <TableCell className="text-right tabular-nums">
                {category.totalItems.toLocaleString("es-AR")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
