import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';

import { brandSlug } from '../catalog/brands-store.service';
import { BraveSearchService } from './brave-search.service';

/**
 * Agregadores de manuales de terceros. Aparecen primeros en la busqueda y no
 * son el fabricante: si no se filtran, el resolvedor propone manual.ar en vez
 * de drean.com.ar.
 */
const AGGREGATORS = new Set([
  'manual.ar',
  'manuals.plus',
  'manualpdf.es',
  'manualslib.com',
  'manualsonline.com',
  'manualzz.com',
  'manuall.com.ar',
  'manuall.es',
  'libble.eu',
  'scribd.com',
  'yumpu.com',
  'mercadolibre.com.ar',
  'articulo.mercadolibre.com.ar',
  'wikipedia.org',
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'linkedin.com',
  'amazon.com',
]);

/** TLD locales que se prueban antes que el global. */
const TLD_ORDER = ['com.ar', 'com', 'com.mx', 'com.br', 'com.uy', 'cl', 'ar'];

export interface DomainCandidate {
  domain: string;
  /** De donde salio: la heuristica del nombre, la busqueda, o las dos. */
  sources: ('heuristic' | 'search')[];
  score: number;
  /** Resultado de pedirle la home: null si no se pudo verificar. */
  httpStatus: number | null;
  /** La pagina menciona manuales, soporte o servicio tecnico. */
  looksOfficial: boolean;
}

export interface DomainResolution {
  brand: string;
  slug: string;
  best: DomainCandidate | null;
  /** Las dos fuentes coincidieron en el mismo dominio. */
  agreement: boolean;
  candidates: DomainCandidate[];
  usedSearch: boolean;
}

const OFFICIAL_MARKERS =
  /(manual|instructivo|soporte|servicio t[eé]cnico|garant[ií]a|descargas|support)/i;

@Injectable()
export class DomainResolverService {
  private readonly logger = new Logger(DomainResolverService.name);

  constructor(
    private readonly brave: BraveSearchService,
    private readonly http: HttpService,
  ) {}

  /**
   * Propone el dominio oficial de una marca cruzando dos fuentes independientes:
   * la heuristica del nombre (gratis) y la busqueda (consume cupo). Despues
   * verifica cada candidato pidiendole la home de verdad.
   *
   * No decide por si solo: devuelve la propuesta con su evidencia para que
   * alguien la acepte. `verified` sigue exigiendo un manual descargado.
   */
  async resolve(brand: string, useSearch = true): Promise<DomainResolution> {
    const slug = brandSlug(brand);
    const candidates = new Map<string, DomainCandidate>();

    const compact = slug.replace(/-/g, '');

    const add = (domain: string, source: 'heuristic' | 'search') => {
      const clean = normalizeDomain(domain);
      if (!clean || isAggregator(clean, compact)) return;

      const existing = candidates.get(clean);
      if (existing) {
        if (!existing.sources.includes(source)) existing.sources.push(source);
        return;
      }
      candidates.set(clean, {
        domain: clean,
        sources: [source],
        score: 0,
        httpStatus: null,
        looksOfficial: false,
      });
    };

    // Fuente 1: el nombre de la marca sobre los TLD mas probables. Gratis.
    for (const tld of TLD_ORDER) {
      add(`${compact}.${tld}`, 'heuristic');
    }

    // Fuente 2: la busqueda. Consume cupo, por eso es opcional.
    let usedSearch = false;
    if (useSearch && this.brave.configured) {
      try {
        // Sin la palabra "manuales": atrae agregadores antes que al fabricante.
        const results = await this.brave.search(
          `"${brand}" sitio oficial electrodomesticos argentina`,
          8,
        );
        usedSearch = true;
        for (const r of results) add(r.url, 'search');
      } catch (error) {
        this.logger.warn(
          `Sin busqueda para ${brand}: ${error instanceof Error ? error.message : 'error'}`,
        );
      }
    }

    // Verificar de verdad: la heuristica genera muchos dominios que no existen.
    const list = [...candidates.values()];
    await Promise.all(list.map((c) => this.verify(c, compact)));

    const alive = list.filter(
      (c) => c.httpStatus !== null && c.httpStatus < 400,
    );
    alive.sort((a, b) => b.score - a.score);

    const best = alive[0] ?? null;
    return {
      brand,
      slug,
      best,
      agreement: best?.sources.length === 2,
      candidates: alive,
      usedSearch,
    };
  }

  /** Puntua un candidato: pide la home y mira si parece el sitio del fabricante. */
  private async verify(
    candidate: DomainCandidate,
    compact: string,
  ): Promise<void> {
    let score = 0;

    // Que el nombre de la marca este en el dominio es la señal mas fuerte.
    const registrable =
      candidate.domain.split('.').slice(0, -2).join('.') || candidate.domain;
    if (candidate.domain.replace(/[.-]/g, '').includes(compact)) score += 40;
    if (registrable === compact || candidate.domain.startsWith(`${compact}.`))
      score += 20;
    if (candidate.sources.length === 2) score += 25;
    if (candidate.domain.endsWith('.com.ar')) score += 10;

    try {
      const { status, data } = await firstValueFrom(
        this.http.get<string>(`https://${candidate.domain}/`, {
          timeout: 12_000,
          maxRedirects: 3,
          responseType: 'text',
          validateStatus: () => true,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (compatible; scrapper-products/1.0; +manual-lookup)',
          },
        }),
      );
      candidate.httpStatus = status;
      if (
        status < 400 &&
        typeof data === 'string' &&
        OFFICIAL_MARKERS.test(data)
      ) {
        candidate.looksOfficial = true;
        score += 30;
      }
    } catch {
      // No resuelve o no responde: se queda con httpStatus null y se descarta.
    }

    candidate.score = score;
  }
}

function normalizeDomain(raw: string): string {
  const value = raw.trim().toLowerCase();
  const host = value.includes('://')
    ? URL.canParse(value)
      ? new URL(value).hostname
      : ''
    : value.split('/')[0];
  return host.replace(/^www\./, '');
}

/** Un dominio cuyo nombre habla de manuales y no de la marca es un agregador. */
const MANUAL_SITE = /(manual|manuais|handbuch|instructiv|guia|guide)/i;

function isAggregator(domain: string, brandCompact = ''): boolean {
  if (AGGREGATORS.has(domain)) return true;
  // Tambien los subdominios de un agregador (m.manualslib.com).
  if ([...AGGREGATORS].some((a) => domain.endsWith(`.${a}`))) return true;

  // Los agregadores nuevos aparecen todo el tiempo, asi que ademas de la lista
  // va la regla: si el nombre del dominio habla de manuales y no contiene la
  // marca, no es el fabricante.
  const registrable = domain.split('.')[0];
  return (
    MANUAL_SITE.test(registrable) &&
    !(brandCompact && registrable.includes(brandCompact))
  );
}
