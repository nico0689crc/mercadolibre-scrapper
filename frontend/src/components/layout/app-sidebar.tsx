"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Boxes,
  Factory,
  FolderTree,
  LayoutDashboard,
  Package,
  Radar,
  Tags,
  type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import type { CatalogStats, CrawlerStatus } from "@/types/api";

const compact = new Intl.NumberFormat("es-AR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

/**
 * Navegacion principal. Los contadores salen de /catalog/stats: el menu es
 * tambien el resumen de que tan llena esta la base.
 */
export function AppSidebar({
  stats,
  crawler,
}: {
  stats: CatalogStats | null;
  crawler: CrawlerStatus | null;
}) {
  const pathname = usePathname();

  const panel: NavItem[] = [{ href: "/", label: "Resumen", icon: LayoutDashboard }];

  const catalog: NavItem[] = [
    {
      href: "/categories",
      label: "Categorias",
      icon: FolderTree,
      count: stats?.categories,
    },
    { href: "/brands", label: "Marcas", icon: Tags, count: stats?.brands },
    { href: "/products", label: "Productos", icon: Package, count: stats?.products },
    { href: "/manufacturers", label: "Fabricantes", icon: Factory },
  ];

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const total = crawler ? crawler.done + crawler.pending : 0;
  const coverage = total > 0 ? Math.round(((crawler?.done ?? 0) / total) * 100) : 0;

  const renderGroup = (label: string, items: NavItem[]) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.href}>
              <SidebarMenuButton asChild isActive={isActive(item.href)} tooltip={item.label}>
                <Link href={item.href}>
                  <item.icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
              {typeof item.count === "number" ? (
                <SidebarMenuBadge>{compact.format(item.count)}</SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg">
              <Link href="/">
                <Boxes aria-hidden="true" />
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-semibold">Scrapper Products</span>
                  <span className="text-muted-foreground truncate text-xs">
                    Catalogo de Mercado Libre
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {renderGroup("Panel", panel)}
        <SidebarSeparator />
        {renderGroup("Catalogo", catalog)}
      </SidebarContent>

      {crawler ? (
        <SidebarFooter>
          <div className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Radar className="size-4" aria-hidden="true" />
                Crawler
              </span>
              <Badge variant={crawler.enabled ? "default" : "secondary"}>
                {crawler.enabled ? "activo" : "detenido"}
              </Badge>
            </div>
            <Progress value={coverage} aria-label="Cobertura del catalogo" />
            <p className="text-muted-foreground text-xs tabular-nums">
              {crawler.done.toLocaleString("es-AR")} de {total.toLocaleString("es-AR")} categorias
            </p>
          </div>
        </SidebarFooter>
      ) : null}

      <SidebarRail />
    </Sidebar>
  );
}
