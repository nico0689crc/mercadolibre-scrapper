import { createHash } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SiteCrawlerService } from './site-crawler.service';

/** Paginas de producto a recorrer por corrida. Acota el tiempo de un pase. */
const MAX_PAGES = 120;
/** Rutas de soporte a tantear cuando el sitio no tiene sitemap util. */
const SUPPORT_PATHS = [
  '/soporte',
  '/manuales',
  '/descargas',
  '/support',
  '/atencion-al-cliente',
  '/servicio-tecnico',
  '/es_AR/soporte',
  '/productos',
];

export interface FoundManual {
  model: string;
  modelRaw: string;
  url: string;
  foundAtUrl: string;
}

export interface CrawlOutcome {
  strategy: 'sitemap' | 'support-paths' | 'none';
  config: Record<string, unknown>;
  manuals: FoundManual[];
  pagesVisited: number;
  skippedByWindow: boolean;
}

/**
 * Descubre manuales en el sitio de un fabricante.
 *
 * Cada fabricante publica distinto, asi que en vez de un adapter por marca se
 * prueban estrategias en orden de costo y se guarda cual funciono. La proxima
 * corrida arranca por esa y no vuelve a tantear.
 */
@Injectable()
export class ManualFinderService {
  private readonly logger = new Logger(ManualFinderService.name);

  constructor(private readonly site: SiteCrawlerService) {}

  async crawl(
    domain: string,
    knownStrategy?: string | null,
  ): Promise<CrawlOutcome> {
    const rules = await this.site.rulesFor(domain);

    // Si el sitio pide una franja horaria, no se lo molesta fuera de ella.
    if (!this.site.insideVisitWindow(rules)) {
      this.logger.log(`${domain}: fuera de su ventana horaria, se pospone`);
      return {
        strategy: 'none',
        config: {},
        manuals: [],
        pagesVisited: 0,
        skippedByWindow: true,
      };
    }

    const order: ('sitemap' | 'support-paths')[] =
      knownStrategy === 'support-paths'
        ? ['support-paths', 'sitemap']
        : ['sitemap', 'support-paths'];

    for (const strategy of order) {
      const result =
        strategy === 'sitemap'
          ? await this.viaSitemap(domain, rules.sitemaps)
          : await this.viaSupportPaths(domain);

      if (result.manuals.length > 0) {
        this.logger.log(
          `${domain}: ${result.manuals.length} manuales via ${strategy} (${result.pagesVisited} paginas)`,
        );
        return { ...result, strategy, skippedByWindow: false };
      }
    }

    return {
      strategy: 'none',
      config: {},
      manuals: [],
      pagesVisited: 0,
      skippedByWindow: false,
    };
  }

  /** Estrategia barata: el sitemap lista las paginas de producto. */
  private async viaSitemap(
    domain: string,
    declared: string[],
  ): Promise<Omit<CrawlOutcome, 'strategy' | 'skippedByWindow'>> {
    const roots =
      declared.length > 0 ? declared : ['/sitemap.xml', '/sitemap_index.xml'];
    const pageUrls: string[] = [];
    const usefulSitemaps: string[] = [];

    for (const root of roots.slice(0, 3)) {
      const url = absolute(domain, root);
      const res = await this.site.fetch(url);
      if (!res || res.status >= 400) continue;

      const locs = extractLocs(res.html);
      // Un indice apunta a otros sitemaps; el que importa es el de productos.
      const subs = locs.filter((l) => l.toLowerCase().includes('.xml'));
      const targets = subs.length > 0 ? pickProductSitemaps(subs) : [];

      if (targets.length > 0) {
        for (const sub of targets.slice(0, 3)) {
          const subRes = await this.site.fetch(sub);
          if (!subRes || subRes.status >= 400) continue;
          usefulSitemaps.push(sub);
          pageUrls.push(
            ...extractLocs(subRes.html).filter((l) => !l.endsWith('.xml')),
          );
        }
      } else {
        usefulSitemaps.push(url);
        pageUrls.push(...locs.filter((l) => !l.endsWith('.xml')));
      }
    }

    const manuals = await this.harvest(
      domain,
      dedupe(pageUrls).slice(0, MAX_PAGES),
    );
    return {
      config: { sitemaps: usefulSitemaps, productPages: pageUrls.length },
      manuals,
      pagesVisited: Math.min(pageUrls.length, MAX_PAGES),
    };
  }

  /** Estrategia de respaldo: tantear rutas de soporte conocidas. */
  private async viaSupportPaths(
    domain: string,
  ): Promise<Omit<CrawlOutcome, 'strategy' | 'skippedByWindow'>> {
    const found: string[] = [];
    const pages: string[] = [];

    for (const path of SUPPORT_PATHS) {
      const res = await this.site.fetch(absolute(domain, path));
      if (!res || res.status >= 400 || !res.html) continue;
      // El 200 no alcanza: hay sitios que sirven una pagina generica para todo.
      if (await this.site.isSoft404(domain, res.html)) continue;
      found.push(path);
      // De la pagina de soporte salen enlaces internos donde suelen estar los PDF.
      pages.push(...internalLinks(domain, res.html).slice(0, 40));
    }

    const manuals = await this.harvest(
      domain,
      dedupe(pages).slice(0, MAX_PAGES),
    );
    return {
      config: { supportPaths: found },
      manuals,
      pagesVisited: Math.min(pages.length, MAX_PAGES),
    };
  }

  /** Recorre paginas buscando el par (modelo, PDF). */
  private async harvest(
    domain: string,
    urls: string[],
  ): Promise<FoundManual[]> {
    const manuals: FoundManual[] = [];

    for (const url of urls) {
      const res = await this.site.fetch(url);
      if (!res || res.status >= 400 || !res.html) continue;
      if (await this.site.isSoft404(domain, res.html)) continue;

      const pdfs = extractPdfLinks(domain, res.html);
      if (pdfs.length === 0) continue;

      const modelRaw = extractModel(res.html);
      if (!modelRaw) continue;

      // Con un solo PDF en la pagina no hay ambiguedad sobre cual es el manual.
      manuals.push({
        model: normalizeModel(modelRaw),
        modelRaw,
        url: pdfs[0],
        foundAtUrl: url,
      });
    }

    return manuals;
  }

  /** Confirma que la URL devuelve un PDF de verdad y lo identifica por hash. */
  async verify(url: string): Promise<{
    ok: boolean;
    contentType: string;
    bytes: number;
    sha256: string;
  } | null> {
    const res = await this.site.fetchBinary(url);
    if (!res) return null;

    const isPdf =
      res.status < 400 &&
      (res.contentType.includes('pdf') ||
        res.body.subarray(0, 4).toString() === '%PDF');

    return {
      ok: isPdf,
      contentType: res.contentType,
      bytes: res.body.length,
      sha256: createHash('sha256').update(res.body).digest('hex'),
    };
  }
}

function absolute(domain: string, path: string): string {
  if (path.startsWith('http')) return path;
  return `https://${domain}${path.startsWith('/') ? path : `/${path}`}`;
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)].map((m) => m[1]);
}

/** Prioriza el sub-sitemap de productos, que es donde viven los manuales. */
function pickProductSitemaps(subs: string[]): string[] {
  const preferred = subs.filter((s) => /product|producto|item/i.test(s));
  return preferred.length > 0 ? preferred : subs;
}

function extractPdfLinks(domain: string, html: string): string[] {
  const raw = [...html.matchAll(/["'(]([^"')\s]*\.pdf[^"')\s]*)/gi)].map(
    (m) => m[1],
  );
  return dedupe(
    raw.map((r) => (r.startsWith('http') ? r : absolute(domain, r))),
  );
}

function internalLinks(domain: string, html: string): string[] {
  const raw = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  return dedupe(
    raw
      .filter((h) => h.startsWith('/') || h.includes(domain))
      .map((h) => (h.startsWith('http') ? h : absolute(domain, h))),
  );
}

/**
 * Busca el codigo de modelo en la pagina. Los sitios lo publican de formas
 * distintas, asi que se prueban varios patrones de mas a menos especifico.
 */
function extractModel(html: string): string | null {
  const patterns = [
    /"code"\s*:\s*"([A-Z0-9][A-Z0-9.\-_/]{3,24})"/,
    /\bmodelo\b[^A-Za-z0-9]{0,24}([A-Z0-9][A-Z0-9.\-_/]{3,24})/i,
    /\bsku\b[^A-Za-z0-9]{0,16}([A-Z0-9][A-Z0-9.\-_/]{3,24})/i,
    /data-(?:model|sku|code)=["']([A-Z0-9][A-Z0-9.\-_/]{3,24})["']/i,
  ];

  for (const pattern of patterns) {
    const match = pattern.exec(html);
    if (match) return match[1];
  }
  return null;
}

export function normalizeModel(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 64);
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
