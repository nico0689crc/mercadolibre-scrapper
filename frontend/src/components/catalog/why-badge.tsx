"use client";

import { Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { ManufacturerStatus } from "@/types/api";

const LABEL: Record<ManufacturerStatus, string> = {
  verified: "Con evidencia",
  candidate: "Umbral automatico",
  rejected: "Descartada",
};

/**
 * El motivo de cada fila resumido en un badge: el texto completo es largo y
 * ensancha la tabla, pero perderlo seria perder justamente lo que explica la
 * decision. Va en un popover.
 */
export function WhyBadge({
  status,
  title,
  detail,
}: {
  status: ManufacturerStatus;
  title: string;
  detail: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge
          variant={status === "rejected" ? "outline" : "secondary"}
          className="cursor-pointer"
        >
          {LABEL[status]}
          <Info className="size-3" aria-hidden="true" />
          <span className="sr-only">Ver por que</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80">
        <div className="space-y-2">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-muted-foreground text-sm text-pretty">{detail}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
