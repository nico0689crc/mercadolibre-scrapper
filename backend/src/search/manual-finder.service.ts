import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';

import { Injectable, Logger } from '@nestjs/common';

import { BraveSearchService } from './brave-search.service';
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

export interface SearchHit {
  url: string;
  sourceDomain: string;
  /** El dominio contiene el nombre de la marca: probablemente sea el fabricante. */
  official: boolean;
  /** La URL termina en .pdf: se puede verificar sin abrir la pagina. */
  direct: boolean;
  /** Titulo y resumen que devolvio el buscador: suelen nombrar el modelo. */
  snippet: string;
}

/**
 * Por que creemos que el PDF corresponde al modelo, de mas a menos firme:
 *
 * - `url`: el modelo entero aparece en la direccion del archivo.
 * - `contenido`: aparece adentro del PDF.
 * - `pagina`: la pagina que lo enlaza lo nombra y era el unico PDF.
 * - `resultado`: el titulo o el resumen del resultado de busqueda lo nombran
 *   entero. Es la señal que salva a los fabricantes que nombran los PDF por
 *   linea y no por modelo.
 * - `tokens`: coincide parte del modelo (`10.12 P ECO` contra `Manual-Next-ECO`).
 *   La mas debil — y la que hay que revisar a mano.
 */
export type MatchReason =
  'url' | 'contenido' | 'pagina' | 'resultado' | 'tokens';

export interface VerifiedFile {
  ok: boolean;
  contentType: string;
  bytes: number;
  sha256: string;
}

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

  constructor(
    private readonly site: SiteCrawlerService,
    private readonly brave: BraveSearchService,
  ) {}

  /**
   * Busca el manual de un modelo puntual, sin restringir a dominios oficiales.
   *
   * Recorrer el sitio del fabricante falla seguido: hay marcas que publican en
   * un subdominio que no esta enlazado (descargas.whirlpool.com.ar), en un CDN
   * de otro pais, o directamente no publican. La busqueda los encuentra igual.
   *
   * Cuesta una consulta del cupo, asi que se usa para los modelos que el crawl
   * no resolvio, no para todos.
   */
  async searchModel(brand: string, model: string): Promise<SearchHit[]> {
    const results = await this.brave.search(`${brand} ${model} manual pdf`, 8);
    if (results.length === 0) return [];

    const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]/g, '');
    const needle = model.toLowerCase();

    return results
      .map((r) => {
        const host = URL.canParse(r.url)
          ? new URL(r.url).hostname.replace(/^www\./, '')
          : '';
        const direct = r.url.toLowerCase().includes('.pdf');
        // Preferir el sitio del fabricante, pero no descartar los agregadores:
        // para muchos modelos son la unica fuente que tiene el manual.
        const official = host.replace(/[.-]/g, '').includes(brandSlug);
        const mentionsModel = `${r.url} ${r.title} ${r.description}`
          .toLowerCase()
          .includes(needle);

        return {
          url: r.url,
          sourceDomain: host,
          official,
          direct,
          snippet: `${r.title} ${r.description}`,
          score:
            (direct ? 50 : 0) + (official ? 30 : 0) + (mentionsModel ? 20 : 0),
        };
      })
      .filter((r) => r.sourceDomain !== '' && r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(({ score: _score, ...hit }) => hit);
  }

  /**
   * Baja el PDF de un candidato de busqueda.
   *
   * Muchos resultados no son el PDF sino la pagina de soporte que lo enlaza
   * (whirlpool.com sirve una ficha por modelo, no el archivo). Abrir esa pagina
   * y quedarse con el PDF que nombra al modelo no cuesta cupo, solo una
   * descarga mas, asi que conviene intentarlo antes de descartar el candidato.
   */
  async resolvePdf(
    hit: SearchHit,
    model: string,
  ): Promise<{
    url: string;
    checked: VerifiedFile;
    reason: MatchReason;
  } | null> {
    const needle = normalizeModel(model);
    const tokens = significantTokens(model);

    if (hit.direct) {
      const file = await this.site.fetchBinary(hit.url);
      if (!file || !isPdf(file)) return null;

      const reason = evidence(hit, needle, tokens, () =>
        pdfMentions(file.body, needle),
      );

      // Sin ninguna señal es solo "un PDF que salio en la busqueda": puede ser
      // el manual de otro producto de la misma marca, o de otro pais.
      return reason ? { url: hit.url, checked: describe(file), reason } : null;
    }

    const page = await this.site.fetch(hit.url);
    if (!page || page.status >= 400 || !page.html) return null;

    const pdfs = extractPdfLinks(hit.sourceDomain, page.html);
    if (pdfs.length === 0) return null;

    const named = pdfs.filter((u) => normalizeModel(u).includes(needle));
    for (const url of named.slice(0, 3)) {
      const checked = await this.verify(url);
      if (checked?.ok) return { url, checked, reason: 'url' };
    }

    const rest = pdfs.filter((u) => !named.includes(u));
    const pageNames = normalizeModel(page.html).includes(needle);

    // La pagina nombra el modelo y enlaza un solo PDF: no hay ambiguedad.
    if (pageNames && rest.length === 1) {
      const checked = await this.verify(rest[0]);
      if (checked?.ok) return { url: rest[0], checked, reason: 'pagina' };
    }

    // La pagina no lo nombra pero el resultado de busqueda si: vale el PDF que
    // comparta al menos parte del modelo.
    const partial = rest.filter((u) => matchesTokens(u, tokens));
    const fallback: MatchReason | null = normalizeModel(hit.snippet).includes(
      needle,
    )
      ? 'resultado'
      : partial.length > 0
        ? 'tokens'
        : null;
    if (!fallback) return null;

    for (const url of (partial.length > 0 ? partial : rest).slice(0, 2)) {
      const checked = await this.verify(url);
      if (checked?.ok) return { url, checked, reason: fallback };
    }
    return null;
  }

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
  async verify(url: string): Promise<VerifiedFile | null> {
    const res = await this.site.fetchBinary(url);
    if (!res) return null;
    return { ...describe(res), ok: isPdf(res) };
  }
}

function isPdf(res: { status: number; contentType: string; body: Buffer }) {
  return (
    res.status < 400 &&
    (res.contentType.includes('pdf') ||
      res.body.subarray(0, 4).toString() === '%PDF')
  );
}

function describe(res: { contentType: string; body: Buffer }): VerifiedFile {
  return {
    ok: true,
    contentType: res.contentType,
    bytes: res.body.length,
    sha256: createHash('sha256').update(res.body).digest('hex'),
  };
}

/**
 * Busca el modelo adentro del PDF.
 *
 * No es un extractor de texto: descomprime los streams y busca la cadena. Con
 * fuentes embebidas con encoding propio el texto sale ilegible y esto no lo
 * encuentra, por eso solo sirve para *aceptar*, nunca para descartar: si dice
 * que no, se cae a las otras señales.
 */
function pdfMentions(body: Buffer, needle: string): boolean {
  let from = 0;
  for (let n = 0; n < 500; n++) {
    const start = body.indexOf('stream', from);
    if (start < 0) break;
    const end = body.indexOf('endstream', start);
    if (end < 0) break;

    let s = start + 'stream'.length;
    if (body[s] === 0x0d) s++;
    if (body[s] === 0x0a) s++;
    const raw = body.subarray(s, end);
    from = end + 'endstream'.length;

    let text: string;
    try {
      text = inflateSync(raw).toString('latin1');
    } catch {
      text = raw.toString('latin1');
    }
    if (normalizeModel(text).includes(needle)) return true;
  }
  return normalizeModel(body.toString('latin1')).includes(needle);
}

/**
 * Que evidencia hay de que el archivo es el manual de ese modelo, de la mas
 * firme a la mas floja. `inside` va al final porque implica descomprimir el
 * PDF entero.
 */
function evidence(
  hit: SearchHit,
  needle: string,
  tokens: string[],
  inside: () => boolean,
): MatchReason | null {
  if (normalizeModel(hit.url).includes(needle)) return 'url';
  if (normalizeModel(hit.snippet).includes(needle)) return 'resultado';
  if (inside()) return 'contenido';
  if (matchesTokens(`${hit.url} ${hit.snippet}`, tokens)) return 'tokens';
  return null;
}

/**
 * Partes del modelo que sirven para reconocerlo. Se descartan las de un solo
 * caracter, que aparecen en cualquier URL por casualidad.
 */
function significantTokens(model: string): string[] {
  return model
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter((t) => t.length >= 2);
}

/** Alcanza con que una parte del modelo aparezca: los PDF se nombran por linea. */
function matchesTokens(text: string, tokens: string[]): boolean {
  if (tokens.length === 0) return false;
  const haystack = normalizeModel(text);
  return tokens.some((t) => haystack.includes(t));
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
