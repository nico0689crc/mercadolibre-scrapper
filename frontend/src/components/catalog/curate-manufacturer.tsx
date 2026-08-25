"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { acceptManufacturerAction, rejectManufacturerAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Manufacturer } from "@/types/api";

/**
 * Curacion manual de una marca. Aceptar exige el dominio oficial porque es de
 * donde despues se baja el manual: sin eso la marca no sirve para nada.
 */
export function CurateManufacturer({ manufacturer }: { manufacturer: Manufacturer }) {
  const [pending, startTransition] = useTransition();
  const [openAccept, setOpenAccept] = useState(false);
  const [openReject, setOpenReject] = useState(false);

  const run = (
    action: (id: string, data: FormData) => Promise<{ ok: boolean; message: string }>,
    formData: FormData,
    close: (open: boolean) => void,
  ) =>
    startTransition(async () => {
      const result = await action(manufacturer.brandId, formData);
      if (result.ok) {
        toast.success("Listo", { description: result.message });
        close(false);
      } else {
        toast.error("No se pudo guardar", { description: result.message });
      }
    });

  const suggested = manufacturer.officialDomains[0] ?? "";

  return (
    <div className="flex items-center gap-1">
      <Dialog open={openAccept} onOpenChange={setOpenAccept}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            {pending ? <Spinner /> : <Check aria-hidden="true" />}
            Aceptar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form action={(fd) => run(acceptManufacturerAction, fd, setOpenAccept)}>
            <DialogHeader>
              <DialogTitle>Aceptar {manufacturer.name} como fabricante</DialogTitle>
              <DialogDescription>
                Anota el dominio desde el que se van a bajar los manuales. Se guarda
                como verificada, que es el estado que exige evidencia.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor={`domains-${manufacturer.brandId}`}>
                  Dominios oficiales
                </Label>
                <Input
                  id={`domains-${manufacturer.brandId}`}
                  name="officialDomains"
                  defaultValue={suggested}
                  placeholder="drean.com.ar, soporte.drean.com.ar"
                  required
                />
                <p className="text-muted-foreground text-xs">
                  Separados por coma. Se limpia solo el <code>https://</code> y lo que
                  venga despues de la barra.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={`notes-a-${manufacturer.brandId}`}>
                  Evidencia o nota
                </Label>
                <Textarea
                  id={`notes-a-${manufacturer.brandId}`}
                  name="notes"
                  rows={3}
                  placeholder="Ej: manual verificado en /medias/Manual-...pdf, 12.5MB"
                />
              </div>
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner /> : null}
                Aceptar como fabricante
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openReject} onOpenChange={setOpenReject}>
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" disabled={pending}>
            <X aria-hidden="true" />
            Descartar
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form action={(fd) => run(rejectManufacturerAction, fd, setOpenReject)}>
            <DialogHeader>
              <DialogTitle>Descartar {manufacturer.name}</DialogTitle>
              <DialogDescription>
                Vendedor de marketplace, marca propia de retail, o un valor que no es una
                marca. Queda registrado el motivo.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 py-4">
              <Label htmlFor={`notes-r-${manufacturer.brandId}`}>Motivo</Label>
              <Textarea
                id={`notes-r-${manufacturer.brandId}`}
                name="notes"
                rows={3}
                placeholder="Ej: vendedor, el dominio no resuelve y el catalogo esta disperso"
              />
            </div>

            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </DialogClose>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? <Spinner /> : null}
                Descartar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
