import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Boxes } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const geistSans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Scrapper Products",
  description: "Marcas por categoria del catalogo de Mercado Libre",
};

const NAV = [
  { href: "/", label: "Resumen" },
  { href: "/categories", label: "Categorias" },
  { href: "/brands", label: "Marcas" },
  { href: "/products", label: "Productos" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <TooltipProvider>
          <header className="bg-background sticky top-0 z-10 border-b">
            <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-6 py-3">
              <Link href="/" className="flex items-center gap-2 font-semibold">
                <Boxes className="size-5" aria-hidden="true" />
                Scrapper Products
              </Link>
              <Separator orientation="vertical" className="h-6" />
              <nav className="flex items-center gap-1">
                {NAV.map((item) => (
                  <Button key={item.href} asChild variant="ghost" size="sm">
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                ))}
              </nav>
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
          <Toaster />
        </TooltipProvider>
      </body>
    </html>
  );
}
