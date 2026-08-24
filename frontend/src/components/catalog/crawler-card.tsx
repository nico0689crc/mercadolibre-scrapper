import Link from "next/link";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { count, relative } from "@/lib/format";
import type { CrawlerStatus } from "@/types/api";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs">{label}</p>
      <div className="text-sm font-medium">{children}</div>
    </div>
  );
}

/**
 * Estado del llenado progresivo: cuanto del arbol ya se escaneo y con que
 * ritmo. El crawler toma una categoria por vez para no comerse el rate limit.
 */
export function CrawlerCard({ crawler }: { crawler: CrawlerStatus }) {
  const total = crawler.done + crawler.pending;
  const coverage = total > 0 ? (crawler.done / total) * 100 : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cobertura del arbol</CardTitle>
        <CardDescription>
          El crawler escanea una categoria por vez y espera entre corridas para no
          chocar con el limite de Mercado Libre.
        </CardDescription>
        <CardAction>
          <Badge variant={crawler.enabled ? "default" : "secondary"}>
            {crawler.running ? "escaneando" : crawler.enabled ? "activo" : "detenido"}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Progress value={coverage} aria-label="Categorias escaneadas" />
          <p className="text-muted-foreground text-sm tabular-nums">
            {count(crawler.done)} de {count(total)} categorias escaneadas (
            {coverage.toFixed(1)}%)
          </p>
        </div>

        <Separator />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Ultima categoria">
            {crawler.lastCategoryId ? (
              <Link className="hover:underline" href={`/categories/${crawler.lastCategoryId}`}>
                {crawler.lastCategoryId}
              </Link>
            ) : (
              "—"
            )}
          </Fact>
          <Fact label="Ultima corrida">{relative(crawler.lastRunAt)}</Fact>
          <Fact label="Pausa entre categorias">
            <span className="tabular-nums">{crawler.delaySeconds}s</span>
          </Fact>
          <Fact label="Muestreo">
            <span className="tabular-nums">
              {crawler.seeds} semillas · {crawler.pages} paginas
            </span>
          </Fact>
        </div>

        {crawler.lastError ? (
          <Alert variant="destructive">
            <AlertTitle>La ultima corrida fallo</AlertTitle>
            <AlertDescription>{crawler.lastError}</AlertDescription>
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
}
