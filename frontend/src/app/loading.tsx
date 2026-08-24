import { TableSkeleton } from "@/components/catalog/table-skeleton";
import { PageShell } from "@/components/layout/page-shell";
import { Card, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Carga de cualquier pantalla: misma forma que el contenido que va a llegar. */
export default function Loading() {
  return (
    <PageShell>
      <div className="flex items-start gap-3">
        <Skeleton className="size-9 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Card key={index}>
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-20" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-72" />
        </CardHeader>
        <TableSkeleton />
      </Card>
    </PageShell>
  );
}
