import { ManualCrawlerCard } from "@/components/catalog/manual-crawler-card";
import { ManualsTable } from "@/components/catalog/manuals-table";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { getManualCrawler, getManualStats, getManuals } from "@/lib/api";
import { count } from "@/lib/format";
import type { Manual, ManualCrawlerStatus, ManualStats } from "@/types/api";

export const dynamic = "force-dynamic";

const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Manuales" }];

export default async function ManualsPage() {
  let items: Manual[];
  let stats: ManualStats;
  let crawler: ManualCrawlerStatus;
  try {
    [items, stats, crawler] = await Promise.all([
      getManuals(),
      getManualStats(),
      getManualCrawler(),
    ]);
  } catch (error) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudieron leer los manuales</AlertTitle>
          <AlertDescription>
            {error instanceof Error ? error.message : "Error desconocido"}
          </AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Manuales"
        description="Un PDF por modelo, confirmado descargandolo. Salen de dos vias: recorrer el sitio del fabricante y, para lo que ahi no aparece, buscar el modelo en la web."
        meta={
          <>
            <Badge variant="secondary">{count(stats.brands)} marcas</Badge>
            <Badge variant="outline">
              Busqueda: {count(crawler.search.used)}/
              {count(crawler.search.quota)} este mes
            </Badge>
          </>
        }
      />

      <ManualCrawlerCard crawler={crawler} />

      <Card>
        <CardHeader>
          <CardTitle>{count(stats.total)} manuales</CardTitle>
          <CardDescription>
            Buscar el modelo en la web encuentra PDF que el recorrido del sitio
            no alcanza, pero no garantiza que sean de ese modelo: los
            fabricantes nombran los archivos por linea. Por eso cada fila
            declara con que evidencia se acepto y las mas flojas quedan a la
            vista para revisarlas.
          </CardDescription>
        </CardHeader>
        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Todavia no hay manuales</EmptyTitle>
              <EmptyDescription>
                El worker recorre un fabricante por vez y espera su franja
                horaria, asi que los primeros tardan.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <ManualsTable items={items} />
          </div>
        )}
      </Card>
    </PageShell>
  );
}
