import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";

import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getCrawler, getStats } from "@/lib/api";
import type { CatalogStats, CrawlerStatus } from "@/types/api";

import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scrapper Products",
  description: "Marcas por categoria del catalogo de Mercado Libre",
};

/**
 * Datos de la barra lateral. Si el backend no responde el shell igual se
 * dibuja: el error concreto lo muestra la pagina.
 */
async function loadShell(): Promise<{
  stats: CatalogStats | null;
  crawler: CrawlerStatus | null;
}> {
  const [stats, crawler] = await Promise.allSettled([getStats(), getCrawler()]);
  return {
    stats: stats.status === "fulfilled" ? stats.value : null,
    crawler: crawler.status === "fulfilled" ? crawler.value : null,
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [{ stats, crawler }, cookieStore] = await Promise.all([loadShell(), cookies()]);
  // La barra recuerda si quedo abierta o cerrada (la cookie la escribe shadcn).
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
        <TooltipProvider>
          <SidebarProvider defaultOpen={defaultOpen}>
            <AppSidebar stats={stats} crawler={crawler} />
            {/* La barra fija y el padding los pone PageShell en cada pagina. */}
            <SidebarInset>{children}</SidebarInset>
          </SidebarProvider>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
