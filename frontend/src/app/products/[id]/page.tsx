import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, ImageOff } from "lucide-react";

import { AttributesTable } from "@/components/catalog/attributes-table";
import { PageHeader } from "@/components/layout/page-header";
import { PageShell } from "@/components/layout/page-shell";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, getProduct } from "@/lib/api";
import { count, dateTime, money, relative } from "@/lib/format";
import type { ProductDetail } from "@/types/api";

export const dynamic = "force-dynamic";

const BASE_CRUMBS = [
  { href: "/", label: "Resumen" },
  { href: "/products", label: "Productos" },
];

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

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default async function ProductPage({ params }: PageProps<"/products/[id]">) {
  const { id } = await params;
  const result = await load(id);

  if (!result.ok) {
    return (
      <PageShell crumbs={[...BASE_CRUMBS, { label: id }]}>
        <Alert variant="destructive">
          <AlertTitle>No se pudo leer el producto</AlertTitle>
          <AlertDescription>{result.error}</AlertDescription>
        </Alert>
      </PageShell>
    );
  }

  const product = result.data;
  const cover = product.pictures[0]?.url ?? product.thumbnail;
  const short = product.name.length > 60 ? `${product.name.slice(0, 60)}…` : product.name;
  const hasDescription = product.mainFeatures.length > 0 || Boolean(product.shortDescription);

  return (
    <PageShell
      crumbs={[
        ...BASE_CRUMBS,
        ...(product.category
          ? [{ href: `/categories/${product.category.id}`, label: product.category.name }]
          : []),
        { label: short },
      ]}
    >
      <PageHeader
        title={product.name}
        meta={
          <>
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
            <span className="text-muted-foreground text-sm">
              detalle de ML {relative(product.detailFetchedAt)}
            </span>
          </>
        }
        actions={
          product.permalink ? (
            <Button asChild variant="outline">
              <a href={product.permalink} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                Ver en Mercado Libre
              </a>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent>
            <div className="bg-muted relative flex aspect-square items-center justify-center overflow-hidden rounded-md">
              {cover ? (
                <Image
                  src={cover}
                  alt={product.name}
                  fill
                  sizes="(min-width: 1024px) 30vw, 90vw"
                  className="object-contain"
                  priority
                />
              ) : (
                <ImageOff className="text-muted-foreground size-8" aria-hidden="true" />
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Precio y publicaciones</CardTitle>
              <CardDescription>
                Publicaciones activas de este producto de catalogo, segun ML.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {product.listingsCount ? (
                <dl className="grid gap-6 sm:grid-cols-4">
                  <Fact
                    label="Desde"
                    value={
                      <span className="text-lg tabular-nums">
                        {money(product.priceMin, product.currencyId)}
                      </span>
                    }
                  />
                  <Fact
                    label="Hasta"
                    value={
                      <span className="text-lg tabular-nums">
                        {money(product.priceMax, product.currencyId)}
                      </span>
                    }
                  />
                  <Fact
                    label="Publicaciones"
                    value={<span className="text-lg tabular-nums">{product.listingsCount}</span>}
                  />
                  <Fact
                    label="Vendedores"
                    value={<span className="text-lg tabular-nums">{product.sellersCount}</span>}
                  />
                </dl>
              ) : (
                <p className="text-muted-foreground text-sm">
                  Sin publicaciones activas: ML responde <code>No winners found</code> para este
                  producto de catalogo.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ficha</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-6 sm:grid-cols-3">
                <Fact
                  label="Marca"
                  value={
                    product.brand ? (
                      <Link
                        className="hover:underline"
                        href={`/products?brandId=${product.brand.id}`}
                      >
                        {product.brand.name}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Fact
                  label="Categoria"
                  value={
                    product.category ? (
                      <Link
                        className="hover:underline"
                        href={`/categories/${product.category.id}`}
                      >
                        {product.category.name}
                      </Link>
                    ) : (
                      "—"
                    )
                  }
                />
                <Fact
                  label="Variantes"
                  value={<span className="tabular-nums">{count(product.childrenCount)}</span>}
                />
                <Fact label="Calidad" value={product.qualityType ?? "—"} />
                <Fact label="Creado en ML" value={dateTime(product.mlDateCreated)} />
                <Fact label="Actualizado en ML" value={dateTime(product.mlLastUpdated)} />
              </dl>
            </CardContent>
          </Card>
        </div>
      </div>

      <Tabs defaultValue="attributes">
        <TabsList>
          <TabsTrigger value="attributes">
            Atributos
            <Badge variant="secondary" className="tabular-nums">
              {product.attributes.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pictures">
            Fotos
            <Badge variant="secondary" className="tabular-nums">
              {product.pictures.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="description">Descripcion</TabsTrigger>
        </TabsList>

        <TabsContent value="attributes">
          <Card className="overflow-hidden">
            <CardHeader>
              <CardTitle>Atributos</CardTitle>
              <CardDescription>
                Tal como los define Mercado Libre. Filtra por nombre o por valor.
              </CardDescription>
            </CardHeader>
            <AttributesTable attributes={product.attributes} />
          </Card>
        </TabsContent>

        <TabsContent value="pictures">
          <Card>
            <CardHeader>
              <CardTitle>Fotos</CardTitle>
              <CardDescription>Imagenes del producto de catalogo.</CardDescription>
            </CardHeader>
            <CardContent>
              {product.pictures.length === 0 ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Sin fotos</EmptyTitle>
                    <EmptyDescription>El catalogo no trajo imagenes para este producto.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="description">
          <Card>
            <CardHeader>
              <CardTitle>Descripcion</CardTitle>
              <CardDescription>
                Caracteristicas principales y descripcion corta, tal como vienen de ML.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasDescription ? (
                <>
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
                </>
              ) : (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>Sin descripcion</EmptyTitle>
                    <EmptyDescription>
                      ML no publica descripcion para este producto de catalogo.
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
