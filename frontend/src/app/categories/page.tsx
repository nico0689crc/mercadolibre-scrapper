import { CategoryTable } from "@/components/catalog/category-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getCategories } from "@/lib/api";
import type { Category } from "@/types/api";

export const dynamic = "force-dynamic";

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
      <Alert variant="destructive">
        <AlertTitle>No se pudieron leer las categorias</AlertTitle>
        <AlertDescription>{data.error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Categorias</h1>
        <p className="text-muted-foreground">
          Categorias raiz del sitio. Entra en una para ver sus hijas y sus marcas.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Raices</CardTitle>
          <CardDescription>
            {data.categories.length} categorias, ordenadas por cantidad de items.
          </CardDescription>
        </CardHeader>
        {data.categories.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>La base esta vacia</EmptyTitle>
              <EmptyDescription>
                Corre <code>POST /api/catalog/sync</code> para traer el arbol desde Mercado Libre.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <CategoryTable categories={data.categories} />
        )}
      </Card>
    </div>
  );
}
