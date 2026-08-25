"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ManualMatchReason } from "@/types/api";

const EVIDENCE: Record<ManualMatchReason, { label: string; detail: string }> = {
  url: {
    label: "Modelo en la URL",
    detail:
      "El nombre del archivo contiene el modelo completo. Es la señal mas firme: no depende de interpretar nada.",
  },
  contenido: {
    label: "Modelo en el PDF",
    detail:
      "El modelo aparece adentro del archivo. Se descomprimieron los streams del PDF y se busco la cadena; si el PDF trae fuentes con encoding propio esto no lo encuentra, asi que sirve para confirmar pero nunca para descartar.",
  },
  pagina: {
    label: "Pagina del modelo",
    detail:
      "La pagina que enlaza el PDF nombra el modelo y era el unico PDF enlazado, asi que no hay ambiguedad sobre cual es.",
  },
  resultado: {
    label: "Resultado de busqueda",
    detail:
      "El titulo o el resumen que devolvio el buscador nombran el modelo completo. Salva a los fabricantes que nombran los PDF por linea y no por modelo.",
  },
  tokens: {
    label: "Coincidencia parcial",
    detail:
      "Solo coincide parte del modelo: el manual de la linea 'Next ECO' para el modelo '10.12 P ECO'. Suele ser correcto porque un PDF cubre varios modelos de la linea, pero es lo que conviene revisar a mano.",
  },
};

/**
 * Ningun PDF llega con una garantia de que sea el manual de ese modelo: llega
 * con una razon. El badge dice cual, y el popover explica que tan firme es.
 */
export function EvidenceBadge({
  reason,
}: {
  reason: ManualMatchReason | null;
}) {
  if (!reason) {
    return <Badge variant="outline">Del sitio oficial</Badge>;
  }

  const { label, detail } = EVIDENCE[reason];
  const firm = reason === "url" || reason === "contenido";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant={firm ? "secondary" : "outline"}
          className="cursor-pointer"
        >
          {label}
          <Info className="size-3" aria-hidden="true" />
          <span className="sr-only">Ver la evidencia</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-2">
          <p className="text-sm font-medium">{label}</p>
          <p className="text-muted-foreground text-sm text-pretty">{detail}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
