"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { scanCategoryAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function ScanButton({ categoryId }: { categoryId: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await scanCategoryAction(categoryId);
          if (result.ok) {
            toast.success("Scan completo", { description: result.message });
          } else {
            toast.error("El scan fallo", { description: result.message });
          }
        })
      }
    >
      {pending ? <Spinner /> : <RefreshCw aria-hidden="true" />}
      {pending ? "Escaneando…" : "Escanear marcas"}
    </Button>
  );
}
