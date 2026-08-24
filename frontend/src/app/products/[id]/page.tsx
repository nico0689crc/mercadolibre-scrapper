import { Fragment } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ApiError, getProduct } from "@/lib/api";
import type { ProductDetail } from "@/types/api";

export const dynamic = "force-dynamic";

function money(value: string | null, currency: string | null): string {
  if (!value) return "—";
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString("es-AR", {
    style: "currency",
    currency: currency ?? "ARS",
    maximumFractionDigits: 0,
  });
}

async function load(
  id: string,
): Promise<{ ok: true; data: ProductDetail } | { ok: false; error: string }> {
  try {
    return { ok: true, data: await getProduct(id) };
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return { ok: false, error: error instanceof Error ? error.message : "Error desconocido" };
  }
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const result = await load(id);

  if (!result.ok) {
    return (
      <Alert variant="destructive">
        <AlertTitle>No se pudo leer el producto</AlertTitle>
        <AlertDescription>{result.error}</AlertDescription>
      </Alert>
    );
  }

  const product = result.data;
  const crumbs = [
    { href: "/products", label: "Productos" },
    product.category
      ? { href: `/categories/${product.category.id}`, label: product.category.name }
      : null,
    product.brand ? { href: `/products?brandId=${product.brand.id}`, label: product.brand.name } : null,
  ].filter((c): c is { href: string; label: string } => c !== null);

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          {crumbs.map((crumb, index) => (
            <Fragment key={crumb.href}>
              {index > 0 ? <BreadcrumbSeparator /> : null}
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href={crumb.href}>{crumb.label}</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
            </Fragment>
          ))}
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{product.id}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {product.id}
            </Badge>
            {product.domainId ? (
              <Badge variant="secondary" className="font-mono text-xs">
                {product.domainId}
              </Badge>
            ) : null}
            <Badge variant={product.status === "active" ? "default" : "secondary"}>
              {product.status}
            </Badge>
          </div>
        </div>
        {product.permalink ? (
          <Button asChild variant="outline" size="sm">
            <a href={product.permalink} target="_blank" rel="noopener noreferrer">
              <ExternalLink aria-hidden="true" />
              Ver en Mercado Libre
            </a>
          </Button>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Precio y publicaciones</CardTitle>
            <CardDescription>
              Datos de las publicaciones activas de este producto de catalogo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {product.listingsCount ? (
              <dl className="grid gap-4 sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground text-sm">Desde</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {money(product.priceMin, product.currencyId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Hasta</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {money(product.priceMax, product.currencyId)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Publicaciones</dt>
                  <dd className="text-lg font-semibold tabular-nums">{product.listingsCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground text-sm">Vendedores</dt>
                  <dd className="text-lg font-semibold tabular-nums">{product.sellersCount}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted-foreground text-sm">
                Sin publicaciones activas. ML responde <code>No winners found</code> para este
                producto.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ficha</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Marca</span>
              <span className="font-medium">{product.brand?.name ?? "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Categoria</span>
              <span className="font-medium">{product.category?.name ?? "—"}</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Variantes</span>
              <span className="font-medium tabular-nums">{product.childrenCount}</span>
            </div>
            <Separator />
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Calidad</span>
              <span className="font-medium">{product.qualityType ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {product.pictures.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Fotos</CardTitle>
            <CardDescription>{product.pictures.length} imagenes del catalogo.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {product.pictures.slice(0, 12).map((picture) => (
                <div
                  key={picture.id}
                  className="bg-muted relative aspect-square overflow-hidden rounded-md"
                >
                  <Image
                    src={picture.url}
                    alt={product.name}
                    fill
                    sizes="(min-width: 1024px) 12vw, 40vw"
                    className="object-contain"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {product.mainFeatures.length > 0 || product.shortDescription ? (
        <Card>
          <CardHeader>
            <CardTitle>Descripcion</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {product.mainFeatures.length > 0 ? (
              <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
                {product.mainFeatures.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            ) : null}
            {product.shortDescription ? (
              <p className="text-muted-foreground text-sm whitespace-pre-line">
                {product.shortDescription}
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Atributos</CardTitle>
          <CardDescription>
            {product.attributes.length} atributos tal como los define Mercado Libre.
          </CardDescription>
        </CardHeader>
        {product.attributes.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Sin atributos guardados</EmptyTitle>
              <EmptyDescription>
                Corre un scan de su categoria para traerlos.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Atributo</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Id</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {product.attributes.map((attribute) => (
                  <TableRow key={attribute.id}>
                    <TableCell className="font-medium">{attribute.name}</TableCell>
                    <TableCell>{attribute.value_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground font-mono text-xs">
                      {attribute.id}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
