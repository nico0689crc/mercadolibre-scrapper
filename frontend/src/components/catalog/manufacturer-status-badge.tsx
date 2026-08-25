import { Badge } from "@/components/ui/badge";
import type { ManufacturerStatus } from "@/types/api";

const LABEL: Record<ManufacturerStatus, string> = {
  verified: "verificado",
  candidate: "candidato",
  rejected: "descartado",
};

const VARIANT: Record<ManufacturerStatus, "default" | "secondary" | "destructive"> = {
  verified: "default",
  candidate: "secondary",
  rejected: "destructive",
};

export function ManufacturerStatusBadge({ status }: { status: ManufacturerStatus | null }) {
  const value = status ?? "candidate";
  return <Badge variant={VARIANT[value]}>{LABEL[value]}</Badge>;
}
