import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { ALLOW_ALL, isAllowed, parseRobots, type RobotsRules } from './robots';

const UA = 'Mozilla/5.0 (compatible; scrapper-products/1.0; +manual-lookup)';
/** Piso de cortesia cuando el sitio no declara Crawl-delay. */
const DEFAULT_DELAY_MS = 1500;
/** Techo por si un robots pide algo absurdo. */
const MAX_DELAY_MS = 15_000;

export interface SiteRules extends RobotsRules {
  /** Ventana horaria UTC que pide el sitio (Visit-time). Drean pide 0400-0845. */
  visitWindow: { fromMinute: number; toMinute: number } | null;
  delayMs: number;
}

export interface PageResult {
  url: string;
  status: number;
  html: string;
}

/**
 * Acceso cortes a un sitio de fabricante.
 *
 * Centraliza lo que hay que respetar sin excepcion: robots.txt parseado por
 * grupo, el ritmo que pide el sitio, y la ventana horaria cuando la declara.
 * Todo lo que salga a un dominio de fabricante pasa por aca.
 */
@Injectable()
export class SiteCrawlerService {
  private readonly logger = new Logger(SiteCrawlerService.name);
  private readonly rules = new Map<string, SiteRules>();
  private readonly lastHit = new Map<string, number>();
  /** Tamaño de la pagina que el sitio devuelve para una ruta inexistente. */
  private readonly soft404 = new Map<string, number | null>();

  constructor(private readonly http: HttpService) {}

  /** Lee y cachea el robots.txt del dominio. Si no existe, permite todo. */
  async rulesFor(domain: string): Promise<SiteRules> {
    const cached = this.rules.get(domain);
    if (cached) return cached;

    let parsed: RobotsRules = ALLOW_ALL;
    let visitWindow: SiteRules['visitWindow'] = null;
    let delayMs = DEFAULT_DELAY_MS;

    try {
      const { status, data } = await firstValueFrom(
        this.http.get<string>(`https://${domain}/robots.txt`, {
          timeout: 15_000,
          responseType: 'text',
          validateStatus: () => true,
          headers: { 'User-Agent': UA },
        }),
      );

      // Muchos sitios devuelven el HTML del 404 con status 200: no es un robots.
      const body = typeof data === 'string' ? data : '';
      const looksHtml = /^\s*</.test(body);

      if (status < 400 && !looksHtml) {
        parsed = parseRobots(body, 'scrapper-products');
        visitWindow = parseVisitTime(body);
        if (parsed.crawlDelayMs) {
          delayMs = Math.min(parsed.crawlDelayMs, MAX_DELAY_MS);
        }
      }
    } catch {
      // Sin robots accesible se sigue con el default, que es permitir.
    }

    const rules: SiteRules = { ...parsed, visitWindow, delayMs };
    this.rules.set(domain, rules);
    this.logger.log(
      `${domain}: delay=${delayMs}ms sitemaps=${rules.sitemaps.length} ventana=${
        visitWindow
          ? `${minutesToHhmm(visitWindow.fromMinute)}-${minutesToHhmm(visitWindow.toMinute)} UTC`
          : 'sin restriccion'
      }`,
    );
    return rules;
  }

  /** Si el sitio pide una franja horaria, respetarla. */
  insideVisitWindow(rules: SiteRules, now = new Date()): boolean {
    if (!rules.visitWindow) return true;
    const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
    const { fromMinute, toMinute } = rules.visitWindow;
    return fromMinute <= toMinute
      ? minute >= fromMinute && minute <= toMinute
      : minute >= fromMinute || minute <= toMinute;
  }

  /**
   * Pide una URL respetando robots y el ritmo. Devuelve null si robots lo
   * prohibe o si la respuesta no sirve.
   */
  async fetch(url: string): Promise<PageResult | null> {
    const parsed = URL.canParse(url) ? new URL(url) : null;
    if (!parsed) return null;

    const domain = parsed.hostname.replace(/^www\./, '');
    const rules = await this.rulesFor(domain);

    if (!isAllowed(rules, parsed.pathname)) {
      this.logger.warn(`robots prohibe ${parsed.pathname} en ${domain}`);
      return null;
    }

    await this.throttle(domain, rules.delayMs);

    try {
      const { status, data } = await firstValueFrom(
        this.http.get<string>(url, {
          timeout: 25_000,
          maxRedirects: 3,
          responseType: 'text',
          validateStatus: () => true,
          headers: { 'User-Agent': UA },
        }),
      );
      return { url, status, html: typeof data === 'string' ? data : '' };
    } catch {
      return null;
    }
  }

  /** Descarga un binario (el PDF) devolviendo el buffer para poder hashearlo. */
  async fetchBinary(
    url: string,
  ): Promise<{ status: number; contentType: string; body: Buffer } | null> {
    const parsed = URL.canParse(url) ? new URL(url) : null;
    if (!parsed) return null;

    const domain = parsed.hostname.replace(/^www\./, '');
    const rules = await this.rulesFor(domain);
    if (!isAllowed(rules, parsed.pathname)) return null;

    await this.throttle(domain, rules.delayMs);

    try {
      const { status, data, headers } = await firstValueFrom(
        this.http.get<ArrayBuffer>(url, {
          timeout: 60_000,
          maxRedirects: 3,
          responseType: 'arraybuffer',
          validateStatus: () => true,
          headers: { 'User-Agent': UA },
        }),
      );
      return {
        status,
        contentType: String(headers['content-type'] ?? ''),
        body: Buffer.from(data),
      };
    } catch {
      return null;
    }
  }

  /**
   * Muchos sitios devuelven 200 con una pagina generica en vez de 404. Sin
   * detectarlo, el crawler cree que existen rutas que no existen: escorial.com.ar
   * responde 200 y los mismos 9376 bytes tanto en /soporte como en /xyzxyz.
   *
   * Se pide una ruta claramente inventada y se recuerda su tamaño; cualquier
   * pagina que mida practicamente lo mismo se descarta.
   */
  async isSoft404(domain: string, html: string): Promise<boolean> {
    if (!this.soft404.has(domain)) {
      const probe = await this.fetch(
        `https://${domain}/scrapper-products-ruta-inexistente-0x9f2b`,
      );
      this.soft404.set(
        domain,
        probe && probe.status < 400 && probe.html ? probe.html.length : null,
      );
    }

    const baseline = this.soft404.get(domain);
    if (baseline === null || baseline === undefined) return false;

    // Un 2% de tolerancia cubre nonces y timestamps que cambian entre pedidos.
    return Math.abs(html.length - baseline) <= Math.max(64, baseline * 0.02);
  }

  private async throttle(domain: string, delayMs: number): Promise<void> {
    const wait = (this.lastHit.get(domain) ?? 0) + delayMs - Date.now();
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastHit.set(domain, Date.now());
  }
}

/** Visit-time no es estandar pero varios sitios lo declaran: "0400-0845". */
function parseVisitTime(body: string): SiteRules['visitWindow'] {
  const match = /^\s*visit-time:\s*(\d{2})(\d{2})\s*-\s*(\d{2})(\d{2})/im.exec(
    body,
  );
  if (!match) return null;
  return {
    fromMinute: Number(match[1]) * 60 + Number(match[2]),
    toMinute: Number(match[3]) * 60 + Number(match[4]),
  };
}

function minutesToHhmm(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
