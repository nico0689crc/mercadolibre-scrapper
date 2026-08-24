"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Vuelve a la pantalla anterior. Si se entro directo por url (no hay historia
 * propia), cae a la seccion padre: /products/MLA123 -> /products.
 */
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  const parent = pathname.split("/").slice(0, -1).join("/") || "/";

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(parent);
        }
      }}
    >
      <ArrowLeft aria-hidden="true" />
      <span className="sr-only">Volver</span>
    </Button>
  );
}
