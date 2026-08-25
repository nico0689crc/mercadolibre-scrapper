import Link from "next/link";

import { ManufacturersTable } from "@/components/catalog/manufacturers-table";
import { MethodologyCard } from "@/components/catalog/methodology-card";
import { PageHeader, SectionHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { getManufacturers, getMethodology, getSearchQuota } from "@/lib/api";
import { oneOf } from "@/lib/filters";
import { count } from "@/lib/format";
import type {
  Manufacturer,
  ManufacturerStatus,
  Methodology,
  SearchQuotaUsage,
} from "@/types/api";

export const dynamic = "force-dynamic";

const SEGMENT = "white_goods";
const CRUMBS = [{ href: "/", label: "Resumen" }, { label: "Fabricantes" }];
const STATUSES = ["all", "verified", "candidate", "rejected"] as const;

const FILTER_LABEL: Record<(typeof STATUSES)[number], string> = {
  all: "Todos",
  verified: "Verificados",
  candidate: "Candidatos",
  rejected: "Descartados",
};

export default async function ManufacturersPage({
  searchParams,
}: PageProps<"/manufacturers">) {
  const params = await searchParams;
  const status = oneOf(params.status, [...STATUSES], "all");

  let items: Manufacturer[];
  let methodology: Methodology;
  let quota: SearchQuotaUsage;
  try {
    [items, methodology, quota] = await Promise.all([
      getManufacturers({
        segment: SEGMENT,
        status: status === "all" ? undefined : (status as ManufacturerStatus),
      }),
      getMethodology(SEGMENT),
      getSearchQuota(),
    ]);
  } catch (error) {
    return (
      <PageShell crumbs={CRUMBS}>
        <Alert variant="destructive">
          <AlertTitle>No se pudieron leer los fabricantes</AlertTitle>
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
        title="Fabricantes"
        description="Marcas a las que les reconocemos identidad de fabricante, que es el subconjunto sobre el que tiene sentido buscar manuales oficiales."
        meta={
          <>
            <Badge variant="outline">{methodology.label}</Badge>
            <Badge variant="secondary">{methodology.domains} dominios</Badge>
            <Badge variant="outline">
              Busqueda: {count(quota.used)}/{count(quota.quota)} este mes
            </Badge>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUSES.map((value) => (
          <Button
            key={value}
            asChild
            size="sm"
            variant={status === value ? "default" : "outline"}
          >
            <Link href={value === "all" ? "/manufacturers" : `/manufacturers?status=${value}`}>
              {FILTER_LABEL[value]}
              {value !== "all" ? (
                <span className="tabular-nums">
                  {count(methodology.counts[value as ManufacturerStatus])}
                </span>
              ) : null}
            </Link>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{count(items.length)} marcas</CardTitle>
          <CardDescription>
            Ordenadas por cantidad de modelos distintos en el segmento, que es la señal
            que sostiene el criterio. El umbral automatico es{" "}
            <strong className="text-foreground">
              {methodology.thresholds.minModels} modelos distintos
            </strong>{" "}
            y{" "}
            <strong className="text-foreground">
              {methodology.thresholds.minProducts} productos
            </strong>{" "}
            dentro de los {methodology.domains} dominios del segmento. Pasarlo hace a la
            marca candidata, no fabricante: eso se confirma a mano.
          </CardDescription>
        </CardHeader>
        {items.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin fabricantes en este estado</EmptyTitle>
              <EmptyDescription>
                Corre la deteccion sobre el segmento para poblar la lista.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <ManufacturersTable items={items} thresholds={methodology.thresholds} />
          </div>
        )}
      </Card>

      <SectionHeader
        title="Por que son fabricantes"
        description="El razonamiento completo, con los numeros calculados sobre la base en este momento."
      />
      <MethodologyCard data={methodology} />
    </PageShell>
  );
}
