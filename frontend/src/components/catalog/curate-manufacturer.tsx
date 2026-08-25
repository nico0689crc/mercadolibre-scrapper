"use client";

import { useState, useTransition } from "react";
import { Check, Pencil, RotateCcw, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import {
  acceptManufacturerAction,
  rejectManufacturerAction,
  resolveDomainAction,
} from "@/app/actions";
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
import { Badge } from "@/components/ui/badge";
import type { DomainResolution, Manufacturer } from "@/types/api";

/**
 * Curacion manual de una marca. Aceptar exige el dominio oficial porque es de
 * donde despues se baja el manual: sin eso la marca no sirve para nada.
 */
export function CurateManufacturer({ manufacturer }: { manufacturer: Manufacturer }) {
  const [pending, startTransition] = useTransition();
  const [openAccept, setOpenAccept] = useState(false);
  const [openReject, setOpenReject] = useState(false);
  const [resolution, setResolution] = useState<DomainResolution | null>(null);

  // Al guardar, la action revalida la ruta y esta instancia se reusa con la
  // prop nueva: sin este sync el input seguiria mostrando el dominio viejo.
  const saved = manufacturer.officialDomains[0] ?? "";
  const [domain, setDomain] = useState(saved);
  const [lastSaved, setLastSaved] = useState(saved);
  if (lastSaved !== saved) {
    setLastSaved(saved);
    setDomain(saved);
  }

  const isVerified = manufacturer.status === "verified";
  const isRejected = manufacturer.status === "rejected";

  /**
   * `useSearch` false resuelve solo con la heuristica del nombre y no gasta
   * cupo de Brave. Se ofrecen las dos porque el cupo gratis es finito.
   */
  const suggest = (useSearch: boolean) =>
    startTransition(async () => {
      const result = await resolveDomainAction(manufacturer.brandId, useSearch);
      setResolution(result.resolution ?? null);

      if (result.ok && result.resolution?.best) {
        setDomain(result.resolution.best.domain);
        toast.success("Dominio propuesto", { description: result.message });
      } else {
        toast.error("Sin propuesta", { description: result.message });
      }
    });

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



  return (
    <div className="flex items-center gap-1">
      <Dialog open={openAccept} onOpenChange={setOpenAccept}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" disabled={pending}>
            {pending ? (
              <Spinner />
            ) : isVerified ? (
              <Pencil aria-hidden="true" />
            ) : isRejected ? (
              <RotateCcw aria-hidden="true" />
            ) : (
              <Check aria-hidden="true" />
            )}
            {isVerified ? "Editar dominio" : isRejected ? "Reactivar" : "Aceptar"}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <form action={(fd) => run(acceptManufacturerAction, fd, setOpenAccept)}>
            <DialogHeader>
              <DialogTitle>
                {isVerified
                  ? `Dominio oficial de ${manufacturer.name}`
                  : `Aceptar ${manufacturer.name} como fabricante`}
              </DialogTitle>
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
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  placeholder="drean.com.ar, soporte.drean.com.ar"
                  required
                />
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => suggest(true)}
                  >
                    {pending ? <Spinner /> : <Sparkles aria-hidden="true" />}
                    Sugerir (usa 1 consulta)
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => suggest(false)}
                  >
                    <Search aria-hidden="true" />
                    Solo heuristica (gratis)
                  </Button>
                </div>

                {resolution ? (
                  <div className="space-y-2 rounded-md border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={resolution.agreement ? "default" : "secondary"}>
                        {resolution.agreement
                          ? "Las dos fuentes coinciden"
                          : "Una sola fuente"}
                      </Badge>
                      {resolution.usedSearch ? null : (
                        <Badge variant="outline">sin gastar cupo</Badge>
                      )}
                    </div>
                    <ul className="space-y-1 text-xs">
                      {resolution.candidates.slice(0, 4).map((c) => (
                        <li key={c.domain} className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            className="font-medium hover:underline"
                            onClick={() => setDomain(c.domain)}
                          >
                            {c.domain}
                          </button>
                          <span className="text-muted-foreground tabular-nums">
                            score {c.score} · http {c.httpStatus}
                          </span>
                          {c.looksOfficial ? (
                            <Badge variant="outline">menciona manuales</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground text-xs">
                    Separados por coma. Se limpia solo el <code>https://</code> y lo que
                    venga despues de la barra.
                  </p>
                )}
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
                {isVerified ? "Guardar dominio" : "Aceptar como fabricante"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {isRejected ? null : (
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
      )}
    </div>
  );
}
