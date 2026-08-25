"use client";

import { useTransition } from "react";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";

import { toggleManualCrawlerAction } from "@/app/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { count, relative } from "@/lib/format";
import type { ManualCrawlerStatus } from "@/types/api";

/**
 * El interruptor del worker, con lo que hace falta para decidir si prenderlo:
 * cuanto cupo queda. Buscar cuesta una consulta por modelo, asi que dejarlo
 * prendido sin mirar el cupo se come el mes.
 */
export function ManualCrawlerCard({
  crawler,
}: {
  crawler: ManualCrawlerStatus;
}) {
  const [pending, startTransition] = useTransition();
  const { used, ceiling, quota } = crawler.search;
  const spent = ceiling > 0 ? Math.min((used / ceiling) * 100, 100) : 0;

  const estado = crawler.running
    ? "trabajando"
    : crawler.enabled
      ? crawler.waitingForWindow
        ? "esperando la franja horaria"
        : "activo"
      : "detenido";

  const toggle = () =>
    startTransition(async () => {
      const result = await toggleManualCrawlerAction(!crawler.enabled);
      if (result.ok) {
        toast.success(crawler.enabled ? "Worker detenido" : "Worker activado", {
          description: result.message,
        });
      } else {
        toast.error("No se pudo cambiar el estado", {
          description: result.message,
        });
      }
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Busqueda automatica</CardTitle>
        <CardDescription>
          Recorre un fabricante por vez: primero su sitio y despues, para los
          modelos que ahi no aparecen, busca el modelo en la web. Cada modelo
          buscado gasta una consulta del cupo mensual.
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Badge variant={crawler.enabled ? "default" : "secondary"}>
            {estado}
          </Badge>
          <Button
            size="sm"
            variant={crawler.enabled ? "outline" : "default"}
            disabled={pending}
            onClick={toggle}
          >
            {pending ? (
              <Spinner />
            ) : crawler.enabled ? (
              <Pause aria-hidden="true" />
            ) : (
              <Play aria-hidden="true" />
            )}
            {crawler.enabled ? "Detener" : "Activar"}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Progress value={spent} aria-label="Cupo de busqueda gastado" />
          <p className="text-muted-foreground text-sm tabular-nums">
            {count(used)} de {count(ceiling)} consultas que puede gastar solo,
            sobre un cupo de {count(quota)} al mes. El resto queda para las
            busquedas a mano.
          </p>
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <span>
            {count(crawler.done)} de {count(crawler.done + crawler.pending)}{" "}
            fabricantes recorridos
          </span>
          <span>{count(crawler.manuals)} manuales</span>
          {crawler.lastBrandName ? (
            <span>
              ultimo: {crawler.lastBrandName} ({relative(crawler.lastRunAt)})
            </span>
          ) : null}
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
