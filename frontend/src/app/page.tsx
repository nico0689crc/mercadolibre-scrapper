import Link from "next/link";
import { FolderTree, History, Package, Tags } from "lucide-react";

import { CrawlerCard } from "@/components/catalog/crawler-card";
import { ScansTable } from "@/components/catalog/scans-table";
import { StatCard } from "@/components/catalog/stat-card";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getCrawler, getScans, getStats } from "@/lib/api";
import type { CatalogStats, CrawlerStatus, ScanRun } from "@/types/api";

export const dynamic = "force-dynamic";

async function load(): Promise<
  | { ok: true; stats: CatalogStats; scans: ScanRun[]; crawler: CrawlerStatus | null }
  | { ok: false; error: string }
> {
  try {
    const [stats, scans, crawler] = await Promise.all([
      getStats(),
      getScans(10),
      // El crawler es informativo: si falla, el resumen igual sirve.
      getCrawler().catch(() => null),
    ]);
    return { ok: true, stats, scans, crawler };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

const CRUMBS = [{ label: "Resumen" }];

export default async function Home() {
  const data = await load();

  if (!data.ok) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudo contactar al backend</AlertTitle>
          <AlertDescription>{data.error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const { stats, scans, crawler } = data;

  return (
    <PageShell crumbs={CRUMBS}>
      <PageHeader
        title="Resumen"
        description="Marcas y productos del catalogo de Mercado Libre acumulados por categoria."
        actions={
          <Button asChild>
            <Link href="/categories">Explorar categorias</Link>
          </Button>
        }
      />

      <section className="space-y-4">
        <SectionHeader
          title="En la base"
          description="Cada tarjeta abre su seccion."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Categorias"
            value={stats.categories}
            hint="Sincronizadas desde ML"
            icon={FolderTree}
            href="/categories"
          />
          <StatCard
            label="Marcas"
            value={stats.brands}
            hint="Distintas, deduplicadas"
            icon={Tags}
            href="/brands"
          />
          <StatCard
            label="Productos"
            value={stats.products}
            hint="De catalogo, con su marca"
            icon={Package}
            href="/products"
          />
          <StatCard
            label="Scans"
            value={stats.scans}
            hint="Corridas registradas"
            icon={History}
          />
        </div>
      </section>

      {crawler ? (
        <section className="space-y-4">
          <SectionHeader
            title="Llenado progresivo"
            description="Como viene el barrido automatico del arbol de categorias."
          />
          <CrawlerCard crawler={crawler} />
        </section>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Actividad reciente"
          description="Las ultimas corridas contra la API de ML y lo que aporto cada una."
        />
        <Card className="overflow-hidden py-0">
          {scans.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Todavia no hay scans</EmptyTitle>
                <EmptyDescription>
                  Entra a una categoria y corre un scan para empezar a juntar marcas.
                </EmptyDescription>
              </EmptyHeader>
              <Button asChild size="sm">
                <Link href="/categories">Ver categorias</Link>
              </Button>
            </Empty>
          ) : (
            <ScansTable scans={scans} />
          )}
        </Card>
      </section>
    </PageShell>
  );
}
