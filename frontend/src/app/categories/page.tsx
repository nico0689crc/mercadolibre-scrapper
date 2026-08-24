import { CategoryTable } from "@/components/catalog/category-table";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCategories } from "@/lib/api";
import { count } from "@/lib/format";
import type { Category } from "@/types/api";

export const dynamic = "force-dynamic";

const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Categorias" }];

async function load(): Promise<
  { ok: true; categories: Category[] } | { ok: false; error: string }
> {
  try {
    return { ok: true, categories: await getCategories() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export default async function CategoriesPage() {
  const data = await load();

  if (!data.ok) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudieron leer las categorias</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const items = data.categories.reduce((sum, category) => sum + category.totalItems, 0);

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Categorias"
        description="Las raices del arbol de Mercado Libre. Entra en una para ver sus hijas, sus marcas y sus productos."
        meta={
          <>
            <Badge variant="secondary" className="tabular-nums">
              {count(data.categories.length)} raices
            </Badge>
            <span className="text-muted-foreground text-sm tabular-nums">
              {count(items)} items en ML
            </span>
          </>
        }
      />

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Raices</CardTitle>
          <CardDescription>
            Filtra por nombre o id, y clickea una cabecera para reordenar.
          </CardDescription>
        </CardHeader>
        <CategoryTable categories={data.categories} />
      </Card>
    </PageShell>
  );
}
