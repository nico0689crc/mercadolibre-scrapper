import { X } from "lucide-react";

import { ManufacturerStatusBadge } from "@/components/catalog/manufacturer-status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { count } from "@/lib/format";
import type { Methodology } from "@/types/api";

/** Un paso del embudo: cuantas marcas quedan y por que se fueron las demas. */
function FunnelStep({
  value,
  label,
  hint,
}: {
  value: number;
  label: string;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-2xl font-semibold tabular-nums">{count(value)}</p>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-xs text-pretty">{hint}</p>
    </div>
  );
}

/**
 * Explica el criterio con los numeros de la base, no con constantes escritas
 * a mano: si el catalogo cambia, la explicacion cambia con el.
 */
export function MethodologyCard({ data }: { data: Methodology }) {
  const { thresholds, funnel, counts, signals } = data;

  // El caso que desarma la intuicion: una marca descartada que gana en GTIN.
  const rejected = signals.filter((s) => s.status === "rejected");
  const verified = signals.filter((s) => s.status === "verified");
  const bestRejected = rejected.reduce<(typeof rejected)[number] | null>(
    (best, s) => (!best || s.gtinValidPct > best.gtinValidPct ? s : best),
    null,
  );
  const worstVerified = verified.reduce<(typeof verified)[number] | null>(
    (worst, s) => (!worst || s.gtinPct < worst.gtinPct ? s : worst),
    null,
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Como se llego a esta lista</CardTitle>
          <CardDescription>
            La tabla <code>brands</code> mezcla fabricantes reales, vendedores con marca
            propia y valores que ni siquiera son marcas. Para buscar manuales oficiales
            solo sirve el primer grupo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-3">
            <FunnelStep
              value={funnel.brandsInSegment}
              label={`Marcas en ${data.label.toLowerCase()}`}
              hint={`Toda marca con al menos un producto en los ${data.domains} dominios del segmento.`}
            />
            <FunnelStep
              value={funnel.candidates}
              label="Pasan el umbral"
              hint={`Al menos ${thresholds.minProducts} productos y ${thresholds.minModels} modelos distintos dentro del segmento.`}
            />
            <FunnelStep
              value={counts.verified}
              label="Verificadas"
              hint="Se bajo un manual real desde un dominio registrado como oficial."
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Que separa un fabricante de un revendedor</h3>
            <p className="text-muted-foreground text-sm text-pretty">
              La cantidad de <strong className="text-foreground">modelos distintos dentro
              del segmento</strong>. Un revendedor no acumula veinte codigos de modelo de
              heladeras: vende lo que consigue, disperso en categorias sin relacion. Un
              fabricante repite marca sobre una linea de producto propia.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Las señales que se descartaron</CardTitle>
          <CardDescription>
            Medido sobre la base, no supuesto. El GTIN es el codigo de barras EAN/UPC y
            trae digito verificador, asi que parecia la señal obvia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {bestRejected && worstVerified ? (
            <Alert>
              <X aria-hidden="true" />
              <AlertTitle>El GTIN no discrimina: esta invertido</AlertTitle>
              <AlertDescription>
                {bestRejected.brand}, que descartamos, declara GTIN en {bestRejected.gtinPct}%
                de sus productos con {bestRejected.gtinValidPct}% de digitos verificadores
                correctos. {worstVerified.brand}, un fabricante verificado, solo llega
                a {worstVerified.gtinPct}%. Los revendedores usan los GTIN reales de lo que
                revenden, asi que validan igual de bien o mejor.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Marca</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Modelos</TableHead>
                  <TableHead className="text-right">Con GTIN</TableHead>
                  <TableHead className="text-right">GTIN valido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.map((s) => (
                  <TableRow key={s.brandId}>
                    <TableCell className="font-medium">{s.brand}</TableCell>
                    <TableCell>
                      <ManufacturerStatusBadge status={s.status} />
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">
                      {count(s.models)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {s.gtinPct}%
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right tabular-nums">
                      {s.gtinValidPct}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-muted-foreground text-sm text-pretty">
            Tambien se probo adivinar el dominio oficial de cada marca: da falsos positivos
            (existe un <code>bellator.com.ar</code> que puede ser otra empresa) y falsos
            negativos (<code>electrolux.com.ar</code> bloquea el pedido,{" "}
            <code>mabe.com.ar</code> rinde el contenido por JavaScript). Sirve como
            confirmacion, no como criterio.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Que significa cada estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-wrap items-start gap-3">
            <ManufacturerStatusBadge status="candidate" />
            <p className="text-muted-foreground max-w-3xl text-pretty">
              Paso el umbral automatico. Es una hipotesis, no una conclusion:{" "}
              {count(counts.candidate)} esperan que alguien confirme el dominio oficial.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <ManufacturerStatusBadge status="verified" />
            <p className="text-muted-foreground max-w-3xl text-pretty">
              <strong className="text-foreground">No se infiere: exige evidencia.</strong>{" "}
              Se registro un dominio oficial y se descargo desde ahi un manual real. Son{" "}
              {count(counts.verified)}.
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-3">
            <ManufacturerStatusBadge status="rejected" />
            <p className="text-muted-foreground max-w-3xl text-pretty">
              Vendedor de marketplace, marca propia de retail o un valor que no es una marca
              (<code>Generica</code>, <code>OEM</code>). Son {count(counts.rejected)}: el
              resto de la basura quedo afuera sola, sin necesidad de descartarla a mano.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
