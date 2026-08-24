import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { count } from "@/lib/format";

/** Metrica del resumen. Con `href` se vuelve la puerta de entrada a su seccion. */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  href,
}: {
  label: string;
  value: number | string;
  hint?: string;
  icon?: LucideIcon;
  href?: string;
}) {
  const card = (
    <Card className={href ? "hover:bg-accent h-full transition-colors" : "h-full"}>
      <CardHeader>
        <CardDescription className="flex items-center gap-2">
          {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
          {label}
        </CardDescription>
        <CardTitle className="text-3xl tabular-nums">
          {typeof value === "number" ? count(value) : value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent>
          <p className="text-muted-foreground text-sm">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {card}
    </Link>
  ) : (
    card
  );
}
